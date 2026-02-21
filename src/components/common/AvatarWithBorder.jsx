import React from 'react';

/**
 * Avatar component with optional border
 * @param {string} photoURL - User's photo URL
 * @param {string} displayName - User's display name (for fallback)
 * @param {string} borderUrl - URL of the avatar border image
 * @param {number} size - Size of the avatar (default: 40)
 */
export default function AvatarWithBorder({ photoURL, displayName, borderUrl, size = 40 }) {
    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="relative inline-block" style={{ width: size, height: size }}>
            {/* Avatar */}
            {photoURL ? (
                <img
                    src={photoURL}
                    alt={displayName || 'Avatar'}
                    className="w-full h-full rounded-full object-cover"
                />
            ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold"
                    style={{ fontSize: size * 0.4 }}
                >
                    {getInitials(displayName)}
                </div>
            )}

            {/* Border Overlay */}
            {borderUrl && (
                <img
                    src={borderUrl}
                    alt="Avatar Border"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{
                        objectFit: 'contain',
                        zIndex: 1
                    }}
                />
            )}
        </div>
    );
}
