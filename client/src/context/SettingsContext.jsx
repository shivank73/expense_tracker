import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// 1. Create the Context
export const SettingsContext = createContext();

// 2. Create a custom hook for easy access
export const useSettings = () => useContext(SettingsContext);

// 3. Create the Provider Wrapper
export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({ currency: '$', theme: 'dark', categoryTags: [] });
  const [loading, setLoading] = useState(true);

  // Fetch settings globally on load
  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get('https://cashcue-api.onrender.com/api/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setSettings(res.data);
        // Apply theme instantly on load
        document.body.setAttribute('data-theme', res.data.theme);
      } catch (error) {
        console.error("Failed to fetch global settings", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGlobalSettings();
  }, []);

  // Function to let Settings.jsx update this global state instantly
  const updateGlobalSettings = (newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.theme) {
        document.body.setAttribute('data-theme', newSettings.theme);
      }
      return updated;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateGlobalSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};