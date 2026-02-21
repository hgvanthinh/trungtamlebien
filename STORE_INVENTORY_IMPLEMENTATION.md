# Store & Inventory Feature Implementation

## Overview
Implemented a complete Store and Inventory system for the learning management platform, allowing:
- **Admins** to manage store items (upload images, set prices in Xu or Đồng vàng)
- **Students** to browse and purchase items using their earned currency
- **Students** to view their purchased items in their inventory

## Files Created

### Services
1. **`src/services/storeService.js`**
   - CRUD operations for store items
   - Image upload/delete to Firebase Storage
   - Functions: `createStoreItem`, `updateStoreItem`, `deleteStoreItem`, `getAllStoreItems`, `getAvailableStoreItems`, `uploadItemImage`, `deleteItemImage`

2. **`src/services/inventoryService.js`**
   - Purchase transaction handling with Firestore transactions
   - Inventory management
   - Functions: `purchaseItem`, `getUserInventory`, `userOwnsItem`, `getInventoryStats`

### Pages
3. **`src/pages/admin/AdminStore.jsx`**
   - Admin interface for managing store items
   - Features:
     - Upload item images
     - Set item name, description, price
     - Choose currency type (Xu or Đồng vàng)
     - Toggle item availability
     - Edit/delete existing items
     - Grid layout with image previews

4. **`src/pages/Store.jsx`**
   - Student store interface
   - Features:
     - Display user's current Xu and Đồng vàng
     - Filter items by currency type
     - Purchase items with validation
     - Visual indicators for owned items
     - Affordability checks
     - Link to inventory

5. **`src/pages/Inventory.jsx`**
   - Student inventory interface
   - Features:
     - Display all purchased items
     - Show purchase statistics (total items, total spent)
     - Filter by currency type
     - Display purchase date and price
     - Link back to store

## Files Modified

### Routing
6. **`src/App.jsx`**
   - Added imports for Store, Inventory, and AdminStore
   - Added routes:
     - `/store` (student)
     - `/inventory` (student)
     - `/admin/store` (admin)

### Navigation
7. **`src/components/layout/Sidebar.jsx`**
   - Added student menu items:
     - "Cửa Hàng" (Store) with storefront icon
     - "Kho Hàng" (Inventory) with inventory_2 icon
   - Added admin menu item:
     - "Quản lý Cửa Hàng" (Store Management)

### Documentation
8. **`ARCHITECTURE.md`**
   - Added Store & Inventory System documentation
   - Documented data structure:
     - `storeItems` collection
     - `inventories` collection
     - User profile fields (coins, gold)

## Data Structure

### Firestore Collections

#### `storeItems`
```javascript
{
  id: string,
  name: string,
  description: string,
  price: number,
  currency: 'coins' | 'gold',
  imageUrl: string,
  available: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `inventories`
```javascript
{
  id: string,
  userId: string,
  itemId: string,
  itemName: string,
  itemDescription: string,
  itemImageUrl: string,
  purchasePrice: number,
  purchaseCurrency: 'coins' | 'gold',
  purchasedAt: Timestamp
}
```

### Firebase Storage
- **Path**: `store-items/{itemId}_{timestamp}_{filename}`
- **Purpose**: Store item images uploaded by admins

## Key Features

### Admin Features
1. **Item Management**
   - Create new items with image upload
   - Edit existing items (update image, price, availability)
   - Delete items (automatically removes image from storage)
   - Toggle item availability

2. **Image Handling**
   - Upload images to Firebase Storage
   - Automatic cleanup of old images when updating
   - Image preview in modal

### Student Features
1. **Shopping Experience**
   - Browse available items
   - Filter by currency type (All/Xu/Đồng vàng)
   - See current balance for both currencies
   - Visual affordability indicators
   - "Already owned" badges

2. **Purchase System**
   - Atomic transactions (currency deduction + inventory addition)
   - Validation checks:
     - Sufficient funds
     - Item not already owned
   - Real-time UI updates after purchase

3. **Inventory Management**
   - View all purchased items
   - Statistics dashboard (total items, total spent)
   - Filter by purchase currency
   - Purchase history with dates

## Security Considerations

### Transaction Safety
- Uses Firestore transactions to ensure atomic operations
- Prevents race conditions during purchases
- Validates user balance before deduction

### Data Validation
- Price must be greater than 0
- Item name is required
- Currency type validation
- User authentication checks

## UI/UX Features

### Design Elements
1. **Modern Card Layout**
   - Grid-based responsive design
   - Hover effects and transitions
   - Gradient backgrounds for currency displays

2. **Visual Feedback**
   - Loading states
   - Success/error messages
   - Disabled states for unavailable actions
   - Badge indicators (owned, out of stock)

3. **Responsive Design**
   - Mobile-friendly grid (1-4 columns based on screen size)
   - Touch-friendly buttons
   - Scrollable content areas

### Color Coding
- **Xu (Coins)**: Yellow/Gold theme
- **Đồng Vàng (Gold)**: Amber theme
- **Store**: Blue/Purple gradient
- **Inventory**: Purple gradient

## Testing Checklist

### Admin Tests
- [ ] Create item with image
- [ ] Create item without image
- [ ] Edit item and change image
- [ ] Edit item without changing image
- [ ] Delete item (verify image deletion)
- [ ] Toggle item availability
- [ ] Validate required fields

### Student Tests
- [ ] View store with sufficient funds
- [ ] View store with insufficient funds
- [ ] Purchase item with Xu
- [ ] Purchase item with Đồng vàng
- [ ] Attempt to purchase already owned item
- [ ] Attempt to purchase with insufficient funds
- [ ] View inventory after purchase
- [ ] Filter items by currency type
- [ ] Navigate between store and inventory

### Integration Tests
- [ ] Currency deduction after purchase
- [ ] Inventory item creation after purchase
- [ ] Transaction rollback on error
- [ ] Image upload/deletion
- [ ] Real-time UI updates

## Future Enhancements

### Potential Features
1. **Item Categories**
   - Organize items by type (cosmetics, power-ups, etc.)
   - Category filtering

2. **Limited Quantity Items**
   - Stock management
   - First-come-first-served items

3. **Item Bundles**
   - Package deals
   - Discounted multi-item purchases

4. **Trading System**
   - Student-to-student item trading
   - Trade history

5. **Item Usage**
   - Consumable items
   - Equippable items (avatars, badges)
   - Item effects/benefits

6. **Purchase History**
   - Detailed transaction log
   - Refund system

7. **Wishlist**
   - Save items for later
   - Notifications when affordable

## Notes

- All images are stored in Firebase Storage under `store-items/` path
- Transactions ensure data consistency during purchases
- The system integrates with existing Xu and Đồng vàng currency system
- Admin can manage items independently of student purchases
- Students can only purchase items marked as "available"
