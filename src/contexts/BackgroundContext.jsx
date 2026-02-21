import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const BackgroundContext = createContext();

export const useBackground = () => {
  const context = useContext(BackgroundContext);
  if (!context) {
    throw new Error('useBackground must be used within BackgroundProvider');
  }
  return context;
};

export const BackgroundProvider = ({ children }) => {
  const [backgroundImage, setBackgroundImage] = useState('');
  const [backgroundImageMobile, setBackgroundImageMobile] = useState('');
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.3);
  const [applyToStudents, setApplyToStudents] = useState(false);

  useEffect(() => {
    // Load initial settings from localStorage
    const savedImage = localStorage.getItem('adminBackgroundImage');
    const savedImageMobile = localStorage.getItem('adminBackgroundImageMobile');
    const savedOpacity = localStorage.getItem('adminBackgroundOpacity');

    if (savedImage) setBackgroundImage(savedImage);
    if (savedImageMobile) setBackgroundImageMobile(savedImageMobile);
    if (savedOpacity) setBackgroundOpacity(parseFloat(savedOpacity));

    // Fetch from Firestore once instead of realtime listener (cost optimization)
    const fetchBackgroundSettings = async () => {
      try {
        const docSnapshot = await getDoc(doc(db, 'settings', 'background'));
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setBackgroundImage(data.imageUrl || '');
          setBackgroundImageMobile(data.imageUrlMobile || '');
          setBackgroundOpacity(data.opacity || 0.3);
          setApplyToStudents(data.applyToStudents || false);

          // Update localStorage
          localStorage.setItem('adminBackgroundImage', data.imageUrl || '');
          localStorage.setItem('adminBackgroundImageMobile', data.imageUrlMobile || '');
          localStorage.setItem('adminBackgroundOpacity', (data.opacity || 0.3).toString());
        }
      } catch (error) {
        console.error('Error fetching background settings:', error);
      }
    };

    fetchBackgroundSettings();
  }, []);

  const updateBackground = (imageUrl, opacity = 0.3, imageUrlMobile = '') => {
    setBackgroundImage(imageUrl);
    setBackgroundImageMobile(imageUrlMobile);
    setBackgroundOpacity(opacity);
    localStorage.setItem('adminBackgroundImage', imageUrl);
    localStorage.setItem('adminBackgroundImageMobile', imageUrlMobile);
    localStorage.setItem('adminBackgroundOpacity', opacity.toString());
  };

  const removeBackground = () => {
    setBackgroundImage('');
    setBackgroundImageMobile('');
    setBackgroundOpacity(0.3);
    localStorage.removeItem('adminBackgroundImage');
    localStorage.removeItem('adminBackgroundImageMobile');
    localStorage.removeItem('adminBackgroundOpacity');
  };

  return (
    <BackgroundContext.Provider
      value={{
        backgroundImage,
        backgroundImageMobile,
        backgroundOpacity,
        applyToStudents,
        updateBackground,
        removeBackground,
      }}
    >
      {children}
    </BackgroundContext.Provider>
  );
};
