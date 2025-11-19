import React from 'react';
// В реальном проекте здесь были бы SVG-иконки
import { FaFacebookF, FaTwitter, FaGithub, FaGoogle } from 'react-icons/fa'; 

const SocialButtons: React.FC = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
      <button className="social-button" style={{ color: '#3b5998' }}>F</button>
      <button className="social-button" style={{ color: '#1da1f2' }}>T</button>
      <button className="social-button" style={{ color: '#000000' }}>G</button>
      <button className="social-button" style={{ color: '#db4437' }}>Go</button>
    </div>
  );
};

export default SocialButtons;