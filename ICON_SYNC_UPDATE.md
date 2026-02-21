# Icon Synchronization Update

## Overview
Updated all Store and Inventory pages to use the unified icon system that already exists in the project.

## Icon Components

### CoinIcon Component
**Location**: `src/components/common/CoinIcon.jsx`

Uses the Material Icon "paid" with yellow color styling to represent Xu (coins) consistently across the application.

```jsx
import CoinIcon from '../components/common/CoinIcon';

// Usage
<CoinIcon size={20} />
```

### GoldIcon Component
**Location**: `src/components/common/GoldIcon.jsx`

Uses the `gold.png` image from the public folder to represent Đồng Vàng (gold) consistently across the application.

```jsx
import GoldIcon from '../components/common/GoldIcon';

// Usage
<GoldIcon size={20} />
```

## Updated Files

### 1. AdminStore.jsx
- ✅ Imported `CoinIcon` and `GoldIcon`
- ✅ Replaced emoji ⭐ with `<CoinIcon size={20} />`
- ✅ Replaced emoji 🪙 with `<GoldIcon size={20} />`
- ✅ Used in item display cards
- ✅ Used in currency selection radio buttons

### 2. Store.jsx
- ✅ Imported `CoinIcon` and `GoldIcon`
- ✅ Replaced emoji in currency balance display
- ✅ Replaced emoji in filter buttons
- ✅ Replaced emoji in item price display
- ✅ Consistent icon sizes: 30px for headers, 20px for prices, 16px for filters

### 3. Inventory.jsx
- ✅ Imported `CoinIcon` and `GoldIcon`
- ✅ Replaced emoji in statistics cards
- ✅ Replaced emoji in filter buttons
- ✅ Replaced emoji in purchase info display
- ✅ Replaced other material-icons with emoji where appropriate

## Icon Usage Patterns

### Currency Display (Large)
```jsx
<CoinIcon size={30} />  // For balance cards
<GoldIcon size={30} />  // For balance cards
```

### Price Display (Medium)
```jsx
<CoinIcon size={20} />  // For item prices
<GoldIcon size={20} />  // For item prices
```

### Filter Buttons (Small)
```jsx
<CoinIcon size={16} />  // For filter buttons
<GoldIcon size={16} />  // For filter buttons
```

## Other Icons Replaced

Material Icons that were replaced with emoji for better compatibility:
- `shopping_cart` → 🛒
- `inventory_2` → 📦
- `image` → 🖼️
- `check_circle` → ✓
- `event` → 📅
- `add` → ➕
- `edit` → ✏️
- `delete` → 🗑️
- `block` → 🚫

## Benefits

1. **Consistency**: All currency icons now match the existing system used in Profile.jsx and Crafting.jsx
2. **Professional**: GoldIcon uses the actual gold.png image instead of emoji
3. **Maintainability**: Centralized icon components make it easy to update styling globally
4. **Compatibility**: No dependency on Material Icons font for currency display

## Testing

Verify that icons display correctly on:
- ✅ Admin Store page (`/admin/store`)
- ✅ Student Store page (`/store`)
- ✅ Student Inventory page (`/inventory`)

All currency icons should now match the style used throughout the rest of the application.
