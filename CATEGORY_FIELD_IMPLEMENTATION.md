# Category Field Implementation

## Overview
Added a "Loại hàng" (Category) field to the Store system, allowing admins to categorize items. Currently supports "Viền Avatar" (Avatar Border) category.

## Changes Made

### 1. AdminStore.jsx
**Added:**
- ✅ `category` field to `formData` state (default: 'avatar-border')
- ✅ Category dropdown in the add/edit form
- ✅ Category badge display on item cards (blue badge)
- ✅ Category field in `handleEdit` and `resetForm` functions

**Form UI:**
```jsx
<select value={formData.category}>
  <option value="avatar-border">🖼️ Viền Avatar</option>
</select>
```

**Card Display:**
```jsx
<span className="bg-blue-100 dark:bg-blue-900 text-blue-700">
  🖼️ Viền Avatar
</span>
```

### 2. Store.jsx (Student View)
**Added:**
- ✅ Category badge on item cards (purple badge for visual distinction)

**Display:**
```jsx
<span className="bg-purple-100 dark:bg-purple-900 text-purple-700">
  🖼️ Viền Avatar
</span>
```

### 3. Inventory.jsx (Student Inventory)
**Added:**
- ✅ Category badge on inventory item cards (purple badge)

### 4. ARCHITECTURE.md
**Updated:**
- Added "Select item category (currently: Viền Avatar)" to admin features
- Added "category" to data structure documentation
- Updated descriptions to mention category display

## Data Structure

### storeItems Collection (Firestore)
```javascript
{
  id: string,
  name: string,
  description: string,
  price: number,
  currency: 'coins' | 'gold',
  category: 'avatar-border', // NEW FIELD
  imageUrl: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Category Types

### Current Categories
- **`avatar-border`**: 🖼️ Viền Avatar - Border/frame for user avatars

### Future Categories (Expandable)
The system is designed to easily add more categories:
```jsx
<select value={formData.category}>
  <option value="avatar-border">🖼️ Viền Avatar</option>
  <option value="badge">🎖️ Huy Hiệu</option>
  <option value="title">🏆 Danh Hiệu</option>
  <option value="theme">🎨 Giao Diện</option>
  <option value="effect">✨ Hiệu Ứng</option>
</select>
```

## UI Design

### Color Coding
- **Admin View**: Blue badge (`bg-blue-100 dark:bg-blue-900`)
- **Student View**: Purple badge (`bg-purple-100 dark:bg-purple-900`)

### Badge Style
- Small, rounded badge with emoji icon
- Positioned below item name
- Consistent across all views

## Benefits

1. **Organization**: Items are now categorized for better management
2. **User Experience**: Students can see what type of item they're buying
3. **Filtering**: Foundation for future category-based filtering
4. **Scalability**: Easy to add new categories as needed
5. **Visual Clarity**: Color-coded badges make categories instantly recognizable

## Future Enhancements

### 1. Category Filtering
Add filter buttons in Store.jsx:
```jsx
<button onClick={() => setFilterCategory('avatar-border')}>
  🖼️ Viền Avatar
</button>
<button onClick={() => setFilterCategory('badge')}>
  🎖️ Huy Hiệu
</button>
```

### 2. Category Statistics
Show category breakdown in inventory:
```jsx
<div>
  <p>Viền Avatar: {stats.avatarBorders}</p>
  <p>Huy Hiệu: {stats.badges}</p>
</div>
```

### 3. Category-Specific Features
Different categories could have different behaviors:
- **Avatar Borders**: Apply to user avatar
- **Badges**: Display on profile
- **Titles**: Show next to username
- **Themes**: Change UI colors
- **Effects**: Animated visual effects

## Migration Notes

### For Existing Data
If you have existing store items without the `category` field:
- **Default handling**: Items without category will default to 'avatar-border'
- **No action required**: The system handles missing categories gracefully

### Optional Cleanup
```javascript
// Add category to existing items
const storeItemsRef = collection(db, 'storeItems');
const snapshot = await getDocs(storeItemsRef);
snapshot.docs.forEach(async (doc) => {
  if (!doc.data().category) {
    await updateDoc(doc.ref, {
      category: 'avatar-border'
    });
  }
});
```

## Testing Checklist

- ✅ Admin can select category when creating new item
- ✅ Admin can see category badge on item cards
- ✅ Admin can edit item category
- ✅ Students see category badge in store
- ✅ Students see category badge in inventory
- ✅ Category persists after save/edit
- ✅ Default category is set correctly

## Example Usage

### Creating an Avatar Border Item
1. Admin goes to `/admin/store`
2. Clicks "➕ Thêm Món Hàng"
3. Fills in:
   - Name: "Viền Vàng Cao Cấp"
   - Description: "Viền avatar màu vàng sang trọng"
   - Category: "🖼️ Viền Avatar" (selected by default)
   - Price: 1000
   - Currency: Đồng Vàng
4. Uploads image
5. Saves

### Student View
- Student sees item in store with purple badge "🖼️ Viền Avatar"
- After purchase, item appears in inventory with same badge
- Badge helps student identify item type at a glance

## Technical Notes

- Category is a required field (dropdown always has a value)
- Currently hardcoded to "Viền Avatar" but easily extensible
- Badge colors differ between admin (blue) and student (purple) views for visual distinction
- Emoji icons make categories instantly recognizable
