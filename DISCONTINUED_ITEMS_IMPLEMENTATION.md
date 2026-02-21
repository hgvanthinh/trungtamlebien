# Discontinued Items & Inventory Cleanup Implementation

## Overview
Implemented two major features:
1. **Auto-delete from inventory**: When admin deletes a store item, it's automatically removed from all student inventories
2. **Discontinued items**: Admin can mark items as "Ngưng bán" (discontinued) - items remain visible but can't be purchased by students who don't already own them

## Changes Made

### 1. storeService.js
**Updated `deleteStoreItem` function:**
```javascript
export const deleteStoreItem = async (itemId) => {
    // ... delete image ...
    
    // NEW: Delete from all student inventories
    const inventoriesQuery = query(
        collection(db, 'inventories'),
        where('itemId', '==', itemId)
    );
    const inventorySnapshot = await getDocs(inventoriesQuery);
    const deletePromises = inventorySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Delete item document
    await deleteDoc(doc(db, 'storeItems', itemId));
};
```

**Result:** When admin clicks "Xóa", the item is removed from:
- ✅ Store items collection
- ✅ All student inventories
- ✅ Firebase Storage (image)

### 2. AdminStore.jsx

#### Added `discontinued` Field
```javascript
const [formData, setFormData] = useState({
    // ... other fields ...
    discontinued: false, // true = ngưng bán
});
```

#### Added `toggleDiscontinued` Function
```javascript
const toggleDiscontinued = async (item) => {
    const newStatus = !item.discontinued;
    const action = newStatus ? 'ngưng bán' : 'mở bán lại';
    
    if (!confirm(`Bạn có chắc muốn ${action} món hàng "${item.name}"?`)) {
        return;
    }

    await updateStoreItem(item.id, { discontinued: newStatus });
    setToast({ 
        type: 'success', 
        message: `Đã ${action} món hàng thành công!` 
    });
    loadItems();
};
```

#### Updated UI
**Badge display:**
```jsx
{item.discontinued && (
    <span className="bg-orange-100 text-orange-700">
        🚫 Ngưng bán
    </span>
)}
```

**Toggle button:**
```jsx
<button
    onClick={() => toggleDiscontinued(item)}
    className={item.discontinued 
        ? 'bg-green-600' // Mở bán lại
        : 'bg-orange-600' // Ngưng bán
    }
>
    {item.discontinued ? '✓ Mở bán lại' : '🚫 Ngưng bán'}
</button>
```

### 3. Store.jsx (Student View)

#### Added Discontinued Badge
```jsx
{item.discontinued && (
    <span className="bg-orange-100 text-orange-700">
        🚫 Ngưng bán
    </span>
)}
```

#### Updated Purchase Button Logic
```javascript
// Disable if discontinued AND not owned
disabled={purchasing || owned || !canAfford || (item.discontinued && !owned)}

// Button styling
className={
    owned ? 'bg-gray-300' // Đã mua
    : (item.discontinued && !owned) ? 'bg-orange-100' // Ngưng bán
    : !canAfford ? 'bg-red-100' // Không đủ tiền
    : 'bg-gradient-to-r from-blue-600 to-purple-600' // Mua ngay
}

// Button text
{owned ? 'Đã mua'
    : (item.discontinued && !owned) ? 'Ngưng bán'
    : !canAfford ? 'Không đủ tiền'
    : 'Mua ngay'
}
```

## Data Structure

### storeItems Collection
```javascript
{
    id: string,
    name: string,
    description: string,
    price: number,
    currency: 'coins' | 'gold',
    category: 'avatar-border',
    discontinued: boolean, // ✨ NEW FIELD
    imageUrl: string,
    createdAt: Timestamp,
    updatedAt: Timestamp
}
```

## Feature Behavior

### Scenario 1: Admin Deletes Item
**Before:**
- Item exists in store
- Student A owns the item (in inventory)
- Student B doesn't own it

**Admin Action:** Clicks "Xóa" button

**After:**
- ✅ Item removed from store
- ✅ Item removed from Student A's inventory
- ✅ Item image deleted from Firebase Storage
- ✅ Student B never sees it

### Scenario 2: Admin Discontinues Item
**Before:**
- Item is active and available
- Student A owns the item
- Student B doesn't own it

**Admin Action:** Clicks "Ngưng bán" button

**After:**
- ✅ Item still visible in store (both students see it)
- ✅ Item shows "🚫 Ngưng bán" badge
- ✅ Student A: Sees "✓ Đã mua" (can still see owned item)
- ✅ Student B: Sees "🚫 Ngưng bán" button (disabled, can't purchase)

### Scenario 3: Admin Re-enables Discontinued Item
**Before:**
- Item is discontinued
- Student C doesn't own it

**Admin Action:** Clicks "✓ Mở bán lại" button

**After:**
- ✅ "Ngưng bán" badge disappears
- ✅ Student C can now purchase the item
- ✅ Button changes to "🛒 Mua ngay"

## UI States

### Admin View (AdminStore.jsx)

| State | Badge | Button Color | Button Text |
|-------|-------|--------------|-------------|
| Active | None | 🟠 Orange | 🚫 Ngưng bán |
| Discontinued | 🚫 Ngưng bán | 🟢 Green | ✓ Mở bán lại |

### Student View (Store.jsx)

| Condition | Badge | Button Color | Button Text | Clickable |
|-----------|-------|--------------|-------------|-----------|
| Owned | None | Gray | ✓ Đã mua | ❌ No |
| Discontinued + Not Owned | 🚫 Ngưng bán | Orange | 🚫 Ngưng bán | ❌ No |
| Active + Can't Afford | None | Red | 🚫 Không đủ tiền | ❌ No |
| Active + Can Afford | None | Blue-Purple Gradient | 🛒 Mua ngay | ✅ Yes |

## Benefits

### 1. Clean Inventory Management
- **Auto-cleanup**: No orphaned inventory items when admin deletes
- **Data consistency**: Inventory always matches available items
- **No confusion**: Students don't see deleted items in their inventory

### 2. Flexible Item Control
- **Soft delete**: Discontinue instead of delete to preserve history
- **Reversible**: Can re-enable items anytime
- **Granular control**: Different from hard delete

### 3. Better UX
- **Clear communication**: Students know why they can't buy
- **Visual feedback**: Orange badges and buttons for discontinued items
- **Consistent**: Same badge style in admin and student views

## Use Cases

### When to Delete (Hard Delete)
- ✅ Item was added by mistake
- ✅ Item is no longer relevant
- ✅ Want to completely remove from system
- ✅ Don't care about purchase history

**Effect:** Item disappears everywhere, including student inventories

### When to Discontinue (Soft Delete)
- ✅ Limited-time offer ended
- ✅ Seasonal item out of season
- ✅ Want to stop new purchases but keep for existing owners
- ✅ Preserve purchase history

**Effect:** Item visible but not purchasable by new students

## Testing Checklist

### Delete Feature
- ✅ Admin deletes item → Item removed from store
- ✅ Admin deletes item → Item removed from all student inventories
- ✅ Admin deletes item → Image deleted from storage
- ✅ Student refreshes inventory → Deleted item no longer appears

### Discontinue Feature
- ✅ Admin clicks "Ngưng bán" → Badge appears
- ✅ Admin clicks "Ngưng bán" → Button changes to "Mở bán lại"
- ✅ Student who owns item → Still sees "Đã mua"
- ✅ Student who doesn't own → Sees "Ngưng bán" (disabled)
- ✅ Admin clicks "Mở bán lại" → Item becomes purchasable again
- ✅ Discontinued item → Still appears in store and inventory

## Migration Notes

### For Existing Data
Items without the `discontinued` field will default to `false` (active):
```javascript
discontinued: item.discontinued || false
```

### Optional: Set All Existing Items to Active
```javascript
const storeItemsRef = collection(db, 'storeItems');
const snapshot = await getDocs(storeItemsRef);
snapshot.docs.forEach(async (doc) => {
  if (doc.data().discontinued === undefined) {
    await updateDoc(doc.ref, { discontinued: false });
  }
});
```

## Example Workflow

### Admin Workflow
1. Admin creates "Viền Vàng Giáng Sinh" item
2. Students buy it during December
3. January arrives → Admin clicks "🚫 Ngưng bán"
4. New students can't buy it anymore
5. Students who bought it still have it in inventory
6. Next December → Admin clicks "✓ Mở bán lại"
7. Item available for purchase again

### Student Experience
**Student A (bought before discontinued):**
- ✅ Sees item in store with "🚫 Ngưng bán" badge
- ✅ Button shows "✓ Đã mua" (gray)
- ✅ Item remains in inventory

**Student B (didn't buy):**
- ✅ Sees item in store with "🚫 Ngưng bán" badge
- ✅ Button shows "🚫 Ngưng bán" (orange, disabled)
- ✅ Cannot purchase

## Summary

| Feature | Before | After |
|---------|--------|-------|
| Delete item | Manual inventory cleanup needed | ✅ Auto-deletes from all inventories |
| Stop selling | Had to delete item | ✅ Can discontinue (soft delete) |
| Re-enable | Had to recreate item | ✅ Can toggle discontinued status |
| Student sees deleted | Item stayed in inventory | ✅ Automatically removed |
| Student sees discontinued | N/A | ✅ Visible but not purchasable |

The system now provides flexible, professional item management with automatic cleanup! 🎉
