import { useState } from 'react';
import Card from '../components/common/Card';
import Icon from '../components/common/Icon';
import SearchBar from '../components/common/SearchBar';
import Button from '../components/common/Button';
import { rulesData } from '../data/mockData';

const Rules = () => {
  const { coreRules, faqs, rewards, penalties } = rulesData;
  const [expandedFaq, setExpandedFaq] = useState(null);

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      {/* Hero */}
      <div className="clay-card p-8 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
        <h1 className="text-3xl md:text-4xl font-black text-[#111812] dark:text-white mb-2">
          Nội quy Trung tâm ⚖️
        </h1>
        <p className="text-[#608a67] dark:text-[#8ba890] text-lg">
          Quy định và hướng dẫn để tạo môi trường học tập tốt nhất
        </p>
      </div>

      {/* Search */}
      <SearchBar placeholder="Tìm kiếm nội quy..." />

      {/* Core Rules */}
      <div>
        <h2 className="text-2xl font-bold text-[#111812] dark:text-white mb-4">
          Quy định cốt lõi
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {coreRules.map((rule, index) => (
            <Card key={index} className="p-6 text-center" variant="hover">
              <div className="size-16 mx-auto mb-4 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <Icon name={rule.icon} size={32} className="text-primary-dark" />
              </div>
              <h3 className="font-bold text-lg text-[#111812] dark:text-white mb-2">
                {rule.title}
              </h3>
              <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                {rule.description}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div>
        <h2 className="text-2xl font-bold text-[#111812] dark:text-white mb-4">
          Câu hỏi thường gặp
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <Card key={index} className="overflow-hidden">
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <h3 className="font-bold text-[#111812] dark:text-white pr-4">
                  {faq.question}
                </h3>
                <Icon
                  name="expand_more"
                  className={`text-[#608a67] dark:text-[#8ba890] transition-transform ${
                    expandedFaq === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expandedFaq === index && (
                <div className="px-6 pb-6 pt-0">
                  <p className="text-[#608a67] dark:text-[#8ba890]">{faq.answer}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Rewards & Penalties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-4 flex items-center gap-2">
            <Icon name="emoji_events" className="text-yellow-500" />
            Phần thưởng
          </h3>
          <ul className="space-y-2">
            {rewards.map((reward, i) => (
              <li key={i} className="flex items-start gap-2 text-[#111812] dark:text-white">
                <span className="text-green-500">✓</span>
                <span>{reward}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20">
          <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-4 flex items-center gap-2">
            <Icon name="warning" className="text-red-500" />
            Hình thức xử lý
          </h3>
          <ul className="space-y-2">
            {penalties.map((penalty, i) => (
              <li key={i} className="flex items-start gap-2 text-[#111812] dark:text-white">
                <span className="text-red-500">•</span>
                <span>{penalty}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Commitment */}
      <Card className="p-8 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
        <div className="flex items-center gap-4 mb-4">
          <input
            type="checkbox"
            id="commitment"
            className="size-6 rounded border-2 border-primary text-primary focus:ring-2 focus:ring-primary/30"
          />
          <label htmlFor="commitment" className="text-lg font-bold text-[#111812] dark:text-white cursor-pointer">
            Tôi đã đọc và đồng ý với các nội quy trên
          </label>
        </div>
        <Button variant="primary" className="w-full md:w-auto" icon="check_circle">
          Xác nhận cam kết
        </Button>
      </Card>
    </div>
  );
};

export default Rules;
