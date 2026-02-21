# Avatar Border Feature Implementation

## Overview
Implemented avatar border feature for store items with category "avatar-border". Students can purchase avatar borders and apply them to their avatars, which will be displayed in Profile and Teaching pages.

## Changes Made

### 1. Inventory.jsx - "Use" Button for Avatar Borders

**Before:**
```jsx
<div>✨ Món hàng của bạn</div>
```

**After:**
```jsx
{item.itemCategory === 'avatar-border' ? (
    <button onClick={() => useAvatarBorder(item)}>
        {userProfile?.activeAvatarBorder === item.itemImageUrl 
            ? '✓ Đang sử dụng' 
            : 'Sử dụng'
        }
    </button>
) : (
    <div>✨ Món hàng của bạn</div>
)}
```

**Function:**
```javascript
const useAvatarBorder = async (item) => {
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
        activeAvatarBorder: item.itemImageUrl || null
    });
    
    updateUserProfile({
        activeAvatarBorder: item.itemImageUrl || null
    });
    
    setToast({ type: 'success', message: `Đang sử dụng viền "${item.itemName}"!` });
};
```

### 2. Removed Item Descriptions

**Store.jsx & Inventory.jsx:**
- ❌ Removed `{item.description && <p>...</p>}`
- ✅ Cleaner UI focusing on essential information

### 3. inventoryService.js - Save Category

**Added field:**
```javascript
const inventoryData = {
    // ... other fields
    itemCategory: itemData.category || '', // ✨ NEW
    // ... other fields
};
```

### 4. Store.jsx - Pass Category

**When purchasing:**
```javascript
await purchaseItem(currentUser.uid, item.id, {
    // ... other fields
    category: item.category, // ✨ NEW
    // ... other fields
});
```

### 5. Avatar Component - Border Support

**Updated Avatar.jsx:**
```javascript
const Avatar = ({ src, alt, name, size, border, borderUrl, className }) => {
    // ... avatar rendering logic
    
    // If borderUrl is provided, wrap with border overlay
    if (borderUrl) {
        return (
            <div className="relative inline-block">
                {avatarContent}
                <img
                    src={borderUrl}
                    alt="Avatar Border"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ objectFit: 'contain', zIndex: 1 }}
                />
            </div>
        );
    }
    
    return avatarContent;
};
```

### 6. AvatarUpload Component

**Added borderUrl prop:**
```jsx
<Avatar 
    src={preview} 
    name={userName} 
    size="xl" 
    borderUrl={borderUrl} // ✨ NEW
/>
```

### 7. Profile.jsx

**Pass activeAvatarBorder:**
```jsx
<AvatarUpload
    currentAvatar={userProfile.avatar}
    userName={userProfile.fullName}
    borderUrl={userProfile.activeAvatarBorder} // ✨ NEW
    onUpload={handleAvatarUpload}
    isLoading={isUploadingAvatar}
/>
```

### 8. Teaching.jsx - All Avatar Displays

**Updated all avatar displays:**
- Overview mode (small avatars)
- Normal mode (large avatars)
- Leaderboard Top 1-10

**Example:**
```jsx
<Avatar 
    src={student.avatar} 
    name={student.fullName} 
    size="lg"
    borderUrl={student.activeAvatarBorder} // ✨ NEW
    border={true}
/>
```

## Data Structure

### users Collection
```javascript
{
    uid: string,
    username: string,
    fullName: string,
    avatar: string,
    activeAvatarBorder: string, // ✨ NEW - URL of active border
    coins: number,
    gold: number,
    // ... other fields
}
```

### inventories Collection
```javascript
{
    id: string,
    userId: string,
    itemId: string,
    itemName: string,
    itemDescription: string,
    itemCategory: string, // ✨ NEW - 'avatar-border'
    itemImageUrl: string,
    purchasePrice: number,
    purchaseCurrency: 'coins' | 'gold',
    purchasedAt: Timestamp
}
```

## User Flow

### 1. Purchase Avatar Border
1. Student goes to `/store`
2. Sees "Viền Vàng Cao Cấp" - 1000 Gold
3. Clicks "🛒 Mua ngay"
4. Confirms → Purchase successful

### 2. Apply Avatar Border
1. Student goes to `/inventory`
2. Sees "Viền Vàng Cao Cấp" with "Sử dụng" button
3. Clicks "Sử dụng"
4. Toast: "Đang sử dụng viền 'Viền Vàng Cao Cấp'!"
5. Button changes to "✓ Đang sử dụng" (green)

### 3. View Avatar with Border
- **Profile page**: Avatar displays with golden border
- **Teaching page (admin)**: Student avatar displays with golden border
- **Leaderboard**: Top students' avatars display with their borders

### 4. Change Border
1. Student purchases "Viền Bạc"
2. Goes to `/inventory`
3. Clicks "Sử dụng" on "Viền Bạc"
4. "Viền Vàng" → "Sử dụng" button (blue-purple)
5. "Viền Bạc" → "✓ Đang sử dụng" button (green)
6. Avatar changes to silver border

## UI States

### Inventory - Avatar Border

| State | Button Color | Button Text |
|-------|--------------|-------------|
| Active | 🟢 Green | ✓ Đang sử dụng |
| Inactive | 🔵 Blue-Purple Gradient | Sử dụng |

### Inventory - Other Items

| State | Badge Color | Badge Text |
|-------|-------------|------------|
| Owned | 🟣 Purple-Blue | ✨ Món hàng của bạn |

## Files Modified

### Created:
- `src/components/common/AvatarWithBorder.jsx` - Standalone component (not used, Avatar.jsx handles it)

### Modified:
- `src/components/common/Avatar.jsx` - Added borderUrl support
- `src/components/profile/AvatarUpload.jsx` - Added borderUrl prop
- `src/pages/Profile.jsx` - Pass activeAvatarBorder
- `src/pages/admin/Teaching.jsx` - Use Avatar component everywhere
- `src/pages/Inventory.jsx` - "Use" button, removed description
- `src/pages/Store.jsx` - Removed description, pass category
- `src/services/inventoryService.js` - Save category

## Benefits

### 1. Personalization
- ✅ Students can customize their avatars
- ✅ Borders show across the entire app
- ✅ Easy to switch between borders

### 2. Gamification
- ✅ Incentive to earn coins/gold
- ✅ Collectible items
- ✅ Status symbol (premium borders)

### 3. Clean UI
- ✅ Removed unnecessary descriptions
- ✅ Clear "Use" button for avatar borders
- ✅ Consistent avatar display everywhere

## Technical Implementation

### Avatar Rendering
```jsx
<div className="relative inline-block">
    {/* Base Avatar */}
    <div className="rounded-full bg-cover" 
         style={{ backgroundImage: `url("${avatar}")` }} 
    />
    
    {/* Border Overlay */}
    {borderUrl && (
        <img 
            src={borderUrl}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ objectFit: 'contain', zIndex: 1 }}
        />
    )}
</div>
```

### Key Points:
- Border is overlaid on top of avatar
- `pointer-events-none` prevents border from blocking clicks
- `objectFit: 'contain'` ensures border scales properly
- `zIndex: 1` ensures border is above avatar

## Testing Checklist

- ✅ Purchase avatar border from store
- ✅ Click "Sử dụng" in inventory
- ✅ Button changes to "✓ Đang sử dụng"
- ✅ Avatar in Profile shows border
- ✅ Avatar in Teaching (admin) shows border
- ✅ Avatar in Leaderboard shows border
- ✅ Switch to different border
- ✅ Previous border button changes back to "Sử dụng"
- ✅ New border button shows "✓ Đang sử dụng"
- ✅ Avatar updates everywhere

## Migration Notes

### For Existing Users
Users without `activeAvatarBorder` will default to no border:
```javascript
borderUrl={userProfile?.activeAvatarBorder}
```

### For Existing Inventory Items
Items without `itemCategory` will be treated as non-avatar-border items and show the default "✨ Món hàng của bạn" badge.

## Summary

| Feature | Before | After |
|---------|--------|-------|
| Avatar borders | ❌ Not supported | ✅ Fully supported |
| Inventory button | Static badge | ✅ Interactive "Use" button |
| Item descriptions | Shown everywhere | ✅ Removed for cleaner UI |
| Avatar display | Basic circular image | ✅ With optional border overlay |
| Border visibility | N/A | ✅ Shows in Profile, Teaching, Leaderboard |

The avatar border system is now fully functional! Students can purchase, apply, and switch between different avatar borders, with the borders displaying consistently across the entire application. 🎉
