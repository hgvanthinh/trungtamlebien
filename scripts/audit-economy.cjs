#!/usr/bin/env node
/**
 * audit-economy.cjs — Rà soát kinh tế Xu / Đồng Vàng
 *
 * Mục tiêu: tìm ra học sinh có số dư KHÔNG GIẢI TRÌNH ĐƯỢC bằng các
 * giao dịch có ghi log, và chấm điểm rủi ro để admin biết ai cần soi trước.
 *
 * CHẠY (read-only, không ghi gì vào Firestore):
 *   cd functions && npm i        # đã có firebase-admin
 *   set GOOGLE_APPLICATION_CREDENTIALS=<đường dẫn serviceAccount.json>
 *   node ../scripts/audit-economy.cjs
 *
 * Tuỳ chọn:
 *   --json <file>   xuất báo cáo JSON đầy đủ
 *   --top <n>       số HS in ra bảng (mặc định 25)
 */

const path = require('path');
const fs = require('fs');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

// ---------- CLI ----------
const argv = process.argv.slice(2);
const getArg = (name, def) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const TOP = Number(getArg('--top', 25));
const JSON_OUT = getArg('--json', null);

// ---------- Hằng số kinh tế (đồng bộ với src/services) ----------
// craftingService.js — chế tạo Vàng từ Xu
const CRAFTING_LEVELS = {
    1: { name: 'An Toàn', cost: 200, successRate: 95 },
    2: { name: 'Rủi Ro', cost: 150, successRate: 75 },
    3: { name: 'Cân Bằng', cost: 100, successRate: 50 },
    4: { name: 'Liều Mạng', cost: 50, successRate: 25 },
};
// Kỳ vọng xu phải trả cho 1 vàng, ở mức TỐT NHẤT cho người chơi.
// = min qua các level của (cost / successRate). Dùng làm chuẩn dưới:
// ai có vàng nhiều hơn mức này cho phép → bất thường.
const BEST_COINS_PER_GOLD = Math.min(
    ...Object.values(CRAFTING_LEVELS).map(c => c.cost / (c.successRate / 100))
);

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'toanthaybien-2c3d2' });
const db = admin.firestore();

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const fmt = (n) => num(n).toLocaleString('vi-VN');
const pad = (s, w) => String(s ?? '').padEnd(w).slice(0, w);
const padL = (s, w) => String(s ?? '').padStart(w);

async function fetchAll(col) {
    const snap = await db.collection(col).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function main() {
    console.log('⏳ Đang tải dữ liệu từ Firestore...\n');

    const [users, transfers, pigLogs, inventories, storeItems, versusResults, weekly, craftLogs] =
        await Promise.all([
            fetchAll('users'),
            fetchAll('transfers'),
            fetchAll('pigGameLogs'),
            fetchAll('inventories'),
            fetchAll('storeItems'),
            fetchAll('versusMatchResults'),
            fetchAll('pigWeeklyResults'),
            fetchAll('craftLogs'),
        ]);

    const students = users.filter(u => u.role === 'student');
    const byUid = new Map(users.map(u => [u.id, u]));

    // ---------- Dựng sổ cái theo từng HS ----------
    const L = () => ({
        coinIn: 0, coinOut: 0, goldIn: 0, goldOut: 0,
        transferInCoins: 0, transferOutCoins: 0,
        transferInGold: 0, transferOutGold: 0,
        transferInCount: 0, transferOutCount: 0,
        spentCoins: 0, spentGold: 0,
        smashGold: 0, smashCount: 0,
        pigBuyGold: 0, foodCoins: 0,
        versusCoins: 0, versusMatches: 0,
        craftCoins: 0, craftGold: 0, craftCount: 0, craftWins: 0,
        counterparties: new Map(),
    });
    const ledger = new Map(students.map(s => [s.id, L()]));
    const get = (uid) => {
        if (!ledger.has(uid)) ledger.set(uid, L());
        return ledger.get(uid);
    };

    // transfers — chuyển khoản giữa HS (zero-sum, không tạo tiền mới)
    for (const t of transfers) {
        const amt = num(t.amount);
        const isGold = t.currency === 'gold';
        if (t.fromUid) {
            const f = get(t.fromUid);
            f.transferOutCount++;
            if (isGold) { f.transferOutGold += amt; f.goldOut += amt; }
            else { f.transferOutCoins += amt; f.coinOut += amt; }
            f.counterparties.set(t.toUid, (f.counterparties.get(t.toUid) || 0) + amt);
        }
        if (t.toUid) {
            const to = get(t.toUid);
            to.transferInCount++;
            if (isGold) { to.transferInGold += amt; to.goldIn += amt; }
            else { to.transferInCoins += amt; to.coinIn += amt; }
            to.counterparties.set(t.fromUid, (to.counterparties.get(t.fromUid) || 0) + amt);
        }
    }

    // pigGameLogs — mua heo (-vàng), mua đồ ăn (-xu), đập heo (+vàng)
    for (const g of pigLogs) {
        if (!g.uid) continue;
        const e = get(g.uid);
        const d = g.detail || {};
        if (g.type === 'buy_pig') { e.pigBuyGold += num(d.goldSpent); e.goldOut += num(d.goldSpent); }
        else if (g.type === 'buy_food') { e.foodCoins += num(d.coinsSpent); e.coinOut += num(d.coinsSpent); }
        else if (g.type === 'smash') { e.smashGold += num(d.goldWon); e.goldIn += num(d.goldWon); e.smashCount++; }
    }

    // inventories — mua hàng trong shop
    for (const it of inventories) {
        if (!it.userId) continue;
        const e = get(it.userId);
        const p = num(it.purchasePrice);
        if (it.purchaseCurrency === 'gold') { e.spentGold += p; e.goldOut += p; }
        else { e.spentCoins += p; e.coinOut += p; }
    }

    // craftLogs — chế tạo vàng từ xu (chỉ có từ khi chuyển sang Cloud Function)
    for (const c of craftLogs) {
        if (!c.uid) continue;
        const e = get(c.uid);
        e.craftCoins += num(c.totalCost);
        e.craftGold += num(c.goldGained);
        e.coinOut += num(c.totalCost);
        e.goldIn += num(c.goldGained);
        e.craftCount++;
        if (c.isSuccess) e.craftWins++;
    }

    // versusMatchResults — thưởng xu người thắng
    for (const r of versusResults) {
        const coins = num(r.coinsAwarded);
        const winner = r.winnerUid || r.winnerId || r.winner;
        if (winner && coins > 0) {
            const e = get(winner);
            e.versusCoins += coins;
            e.coinIn += coins;
        }
        for (const k of ['player1', 'player2']) {
            const uid = r[k]?.uid || r[`${k}Uid`];
            if (uid && ledger.has(uid)) ledger.get(uid).versusMatches++;
        }
    }

    // ---------- Chấm điểm từng HS ----------
    const rows = students.map(s => {
        const e = get(s.id);
        const coins = num(s.coins);
        const gold = num(s.gold);

        // Số dư giải trình được = thu có log - chi có log.
        // Không tính phần admin cấp tay (không có log) → xem mục cảnh báo bên dưới.
        const explainedCoins = e.coinIn - e.coinOut;
        const explainedGold = e.goldIn - e.goldOut;

        // Vàng chỉ đến từ: chế tạo, đập heo, nhận chuyển khoản, admin cấp.
        // Phần vàng KHÔNG có log nào giải thích được — với giao dịch phát sinh
        // sau khi chuyển sang Cloud Function thì craftLogs đã ghi nhận (nằm
        // trong goldIn), nên phần dư dưới đây là vàng từ thời chưa có log.
        const goldFromCraft = Math.max(0, gold + e.goldOut - e.goldIn);
        const impliedCoinBurn = goldFromCraft * BEST_COINS_PER_GOLD;

        // Tổng xu HS từng phải có để giải trình được số vàng đang cầm
        const totalCoinsNeeded = impliedCoinBurn + e.coinOut + coins;
        const coinsAccounted = e.coinIn;
        const unexplainedCoins = totalCoinsNeeded - coinsAccounted;

        const flags = [];
        if (coins < 0) flags.push('SỐ DƯ XU ÂM');
        if (gold < 0) flags.push('SỐ DƯ VÀNG ÂM');
        if (!Number.isInteger(coins) || !Number.isInteger(gold)) flags.push('SỐ DƯ KHÔNG NGUYÊN');

        // Nhận chuyển khoản áp đảo so với tự kiếm → dấu hiệu gom tiền / tài khoản farm
        const selfEarned = e.smashGold + e.versusCoins;
        if (e.transferInCoins + e.transferInGold > 0 &&
            e.transferInCoins + e.transferInGold > (selfEarned + 1) * 3) {
            flags.push('CHỦ YẾU NHẬN CHUYỂN KHOẢN');
        }

        // Vàng nhiều nhưng gần như không có hoạt động sinh vàng nào
        if (gold >= 20 && e.smashCount === 0 && e.transferInGold === 0 && goldFromCraft > 0) {
            const coinsEverSeen = e.coinIn + coins + e.coinOut;
            if (impliedCoinBurn > coinsEverSeen * 2) flags.push('VÀNG VƯỢT KHẢ NĂNG CHẾ TẠO');
        }

        // Đập heo nhiều hơn số lượt từng được cấp
        if (e.smashCount > 0) {
            const granted = weekly.reduce((acc, w) => {
                const list = w.awarded || w.winners || w.topPigs || [];
                return acc + (Array.isArray(list) ? list.filter(x => (x.uid || x) === s.id).length : 0);
            }, 0);
            if (granted > 0 && e.smashCount > granted + num(s.smashAttempts)) {
                flags.push('ĐẬP HEO VƯỢT LƯỢT ĐƯỢC CẤP');
            }
        }

        // Quy ước approved giống transferService.isAccountApproved:
        // approved===true → duyệt; approved===false → chưa; thiếu field + đã có lớp → coi như duyệt.
        const approved = s.approved === true
            ? true
            : s.approved === false
                ? false
                : Array.isArray(s.classes) && s.classes.length > 0;
        if (!approved && (coins > 0 || gold > 0)) flags.push('CHƯA DUYỆT NHƯNG CÓ TIỀN');

        // Điểm rủi ro: phần xu không giải trình được, cộng trọng số cho các cờ
        const riskScore = Math.round(
            Math.max(0, unexplainedCoins) / 100 +
            flags.length * 50 +
            gold * 2
        );

        return {
            uid: s.id,
            name: s.fullName || s.username || s.id,
            username: s.username || '',
            approved,
            coins, gold,
            netWorthCoins: coins + gold * BEST_COINS_PER_GOLD,
            explainedCoins, explainedGold,
            unexplainedCoins: Math.round(unexplainedCoins),
            goldFromCraft,
            impliedCoinBurn: Math.round(impliedCoinBurn),
            ...e,
            counterparties: undefined,
            topCounterparty: [...e.counterparties.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([uid, amt]) => ({
                    uid,
                    name: byUid.get(uid)?.fullName || byUid.get(uid)?.username || uid,
                    amount: amt,
                })),
            flags,
            riskScore,
        };
    });

    // ---------- Tổng quan hệ thống ----------
    const totalCoins = rows.reduce((a, r) => a + r.coins, 0);
    const totalGold = rows.reduce((a, r) => a + r.gold, 0);
    const totalUnexplained = rows.reduce((a, r) => a + Math.max(0, r.unexplainedCoins), 0);
    const sortedByWorth = [...rows].sort((a, b) => b.netWorthCoins - a.netWorthCoins);
    const totalWorth = sortedByWorth.reduce((a, r) => a + r.netWorthCoins, 0);
    const top1pct = sortedByWorth.slice(0, Math.max(1, Math.ceil(rows.length * 0.01)));
    const top10 = sortedByWorth.slice(0, 10);

    const line = (c = '─') => console.log(c.repeat(100));

    line('═');
    console.log('  BÁO CÁO RÀ SOÁT KINH TẾ — XU / ĐỒNG VÀNG');
    console.log(`  Thời điểm: ${new Date().toLocaleString('vi-VN')}`);
    line('═');

    console.log('\n▌ 1. TỔNG QUAN');
    console.log(`   Học sinh:                 ${fmt(rows.length)}`);
    console.log(`   Tổng Xu lưu hành:         ${fmt(totalCoins)}`);
    console.log(`   Tổng Vàng lưu hành:       ${fmt(totalGold)}`);
    console.log(`   Quy đổi tổng tài sản:     ${fmt(Math.round(totalWorth))} xu`);
    console.log(`   Giao dịch chuyển khoản:   ${fmt(transfers.length)}`);
    console.log(`   Log game heo:             ${fmt(pigLogs.length)}`);
    console.log(`   Lượt mua hàng:            ${fmt(inventories.length)} / ${fmt(storeItems.length)} món`);
    console.log(`   Trận đấu trí:             ${fmt(versusResults.length)}`);
    console.log(`   Lượt chế tạo (có log):    ${fmt(craftLogs.length)}`
        + (craftLogs.length === 0 ? '  ← chưa có, log bắt đầu từ khi deploy Cloud Function' : ''));

    console.log('\n▌ 2. MỨC ĐỘ TẬP TRUNG TÀI SẢN');
    const shareTop10 = totalWorth > 0
        ? (top10.reduce((a, r) => a + r.netWorthCoins, 0) / totalWorth * 100) : 0;
    const shareTop1 = totalWorth > 0
        ? (top1pct.reduce((a, r) => a + r.netWorthCoins, 0) / totalWorth * 100) : 0;
    console.log(`   Top 10 HS nắm:            ${shareTop10.toFixed(1)}% tổng tài sản`);
    console.log(`   Top 1% HS nắm:            ${shareTop1.toFixed(1)}% tổng tài sản`);
    console.log(`   Trung vị tài sản:         ${fmt(Math.round(
        sortedByWorth[Math.floor(sortedByWorth.length / 2)]?.netWorthCoins || 0))} xu`);
    console.log(`   Cao nhất:                 ${fmt(Math.round(sortedByWorth[0]?.netWorthCoins || 0))} xu`
        + ` (${sortedByWorth[0]?.name || '-'})`);

    console.log('\n▌ 3. XU KHÔNG GIẢI TRÌNH ĐƯỢC');
    console.log(`   Quy ước: 1 vàng rẻ nhất tốn ${BEST_COINS_PER_GOLD.toFixed(0)} xu (chế tạo mức tối ưu).`);
    console.log(`   Phần chênh = số dư hiện có - (thu có log - chi có log).`);
    console.log(`   Tổng xu không giải trình:  ${fmt(Math.round(totalUnexplained))}`);
    console.log(`   → Phần lớn đến từ admin cấp tay (Students/Violations) vốn KHÔNG ghi log.`);
    console.log(`     Chỉ số này chỉ dùng để XẾP ƯU TIÊN soi, không phải bằng chứng gian lận.`);

    const flagged = rows.filter(r => r.flags.length > 0).sort((a, b) => b.riskScore - a.riskScore);
    console.log('\n▌ 4. TÀI KHOẢN CÓ DẤU HIỆU BẤT THƯỜNG');
    if (flagged.length === 0) {
        console.log('   ✅ Không có tài khoản nào dính cờ cảnh báo.');
    } else {
        console.log(`   ⚠️  ${flagged.length} tài khoản dính cờ:\n`);
        for (const r of flagged.slice(0, TOP)) {
            console.log(`   • ${r.name} (@${r.username})  —  ${fmt(r.coins)} xu, ${fmt(r.gold)} vàng`);
            console.log(`     Cờ: ${r.flags.join(' | ')}`);
            console.log(`     Nhận CK: ${fmt(r.transferInCoins)} xu + ${fmt(r.transferInGold)} vàng`
                + ` (${r.transferInCount} lần) · Đập heo: ${r.smashCount} lần (+${fmt(r.smashGold)} vàng)`);
            if (r.topCounterparty.length) {
                console.log(`     Đối tác chính: ` +
                    r.topCounterparty.map(c => `${c.name} (${fmt(c.amount)})`).join(', '));
            }
            console.log('');
        }
    }

    console.log(`▌ 5. TOP ${TOP} HỌC SINH GIÀU NHẤT`);
    line();
    console.log(pad('#', 4) + pad('Học sinh', 24) + padL('Xu', 10) + padL('Vàng', 8) +
        padL('Quy đổi', 12) + padL('Chưa GT', 12) + '  Cờ');
    line();
    sortedByWorth.slice(0, TOP).forEach((r, i) => {
        console.log(
            pad(i + 1, 4) + pad(r.name, 24) + padL(fmt(r.coins), 10) + padL(fmt(r.gold), 8) +
            padL(fmt(Math.round(r.netWorthCoins)), 12) +
            padL(fmt(r.unexplainedCoins), 12) +
            '  ' + (r.flags.length ? '⚠️ ' + r.flags.length : '')
        );
    });
    line();

    console.log('\n▌ 6. DÒNG CHUYỂN KHOẢN LỚN NHẤT');
    const pairs = new Map();
    for (const t of transfers) {
        const key = `${t.fromUid}→${t.toUid}`;
        const p = pairs.get(key) || { from: t.fromUid, to: t.toUid, coins: 0, gold: 0, count: 0 };
        if (t.currency === 'gold') p.gold += num(t.amount); else p.coins += num(t.amount);
        p.count++;
        pairs.set(key, p);
    }
    const nameOf = (uid) => byUid.get(uid)?.fullName || byUid.get(uid)?.username || uid || '?';
    const topPairs = [...pairs.values()]
        .sort((a, b) => (b.coins + b.gold * BEST_COINS_PER_GOLD) - (a.coins + a.gold * BEST_COINS_PER_GOLD))
        .slice(0, 15);
    if (topPairs.length === 0) console.log('   (chưa có giao dịch nào)');
    topPairs.forEach((p, i) => {
        console.log(`   ${padL(i + 1, 2)}. ${pad(nameOf(p.from), 20)} → ${pad(nameOf(p.to), 20)}` +
            ` ${padL(fmt(p.coins), 9)} xu ${padL(fmt(p.gold), 6)} vàng  (${p.count} lần)`);
    });

    // Chuyển khoản 2 chiều — dấu hiệu bơm qua lại giữa 2 tài khoản
    console.log('\n▌ 7. CẶP CHUYỂN KHOẢN QUA LẠI (nghi bơm tiền)');
    const circular = [];
    for (const p of pairs.values()) {
        const rev = pairs.get(`${p.to}→${p.from}`);
        if (rev && p.from < p.to) {
            circular.push({ a: p.from, b: p.to, ab: p.count, ba: rev.count,
                vol: p.coins + rev.coins + (p.gold + rev.gold) * BEST_COINS_PER_GOLD });
        }
    }
    circular.sort((x, y) => y.vol - x.vol);
    if (circular.length === 0) console.log('   ✅ Không phát hiện cặp chuyển qua lại.');
    circular.slice(0, 10).forEach((c, i) => {
        console.log(`   ${padL(i + 1, 2)}. ${pad(nameOf(c.a), 20)} ⇄ ${pad(nameOf(c.b), 20)}` +
            ` ${c.ab} lượt đi / ${c.ba} lượt về · tổng ~${fmt(Math.round(c.vol))} xu`);
    });

    line('═');
    console.log('  Ghi chú: script CHỈ ĐỌC, không sửa dữ liệu.');
    line('═');

    if (JSON_OUT) {
        const out = {
            generatedAt: new Date().toISOString(),
            summary: {
                students: rows.length, totalCoins, totalGold,
                totalWorthCoins: Math.round(totalWorth),
                shareTop10Pct: Number(shareTop10.toFixed(2)),
                totalUnexplainedCoins: Math.round(totalUnexplained),
                bestCoinsPerGold: BEST_COINS_PER_GOLD,
            },
            students: sortedByWorth,
            flagged,
            topTransferPairs: topPairs.map(p => ({ ...p, fromName: nameOf(p.from), toName: nameOf(p.to) })),
            circularTransfers: circular.map(c => ({ ...c, aName: nameOf(c.a), bName: nameOf(c.b) })),
        };
        fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2), 'utf8');
        console.log(`\n📄 Đã ghi JSON: ${JSON_OUT}`);
    }
}

main().then(() => process.exit(0)).catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
});
