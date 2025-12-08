// components/AuthIllustration.tsx
import React from 'react';

interface AuthIllustrationProps {
  imageSrc: string;
  altText: string;
}

const AuthIllustration: React.FC<AuthIllustrationProps> = ({ imageSrc, altText }) => {
  return (
    <div className="auth-illustration">
      <img 
        src={imageSrc} 
        alt={altText}
        style={{ 
          maxWidth: '100%', 
          maxHeight: '100%', 
          objectFit: 'contain',
          borderRadius: '4px'
        }}
      />
    </div>
  );
};

export default AuthIllustration;