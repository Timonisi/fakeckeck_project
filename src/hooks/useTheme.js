import { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { useAppearance } from '@vkontakte/vk-bridge-react';

export const useTheme = () => {
  // Используем useAppearance из VK Bridge React для отслеживания изменений темы в реальном времени
  const vkAppearance = useAppearance();
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkTheme = async () => {
      try {
        // Используем данные из useAppearance или получаем из VK Bridge
        let appearance = vkAppearance;
        
        if (!appearance) {
          // Если useAppearance не вернул значение, получаем через VK Bridge
          const config = await bridge.send('VKWebAppGetConfig');
          appearance = config?.color_scheme || config?.appearance;
        }
        
        // Проверяем, является ли тема светлой
        const isLight = appearance === 'light' || 
                       appearance === 'bright' ||
                       (appearance === undefined && window.matchMedia('(prefers-color-scheme: light)').matches);
        
        setIsLightTheme(isLight);
      } catch (error) {
        console.warn('Не удалось получить тему от VK Bridge:', error);
        
        // Fallback: проверяем системные настройки
        const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        setIsLightTheme(isLight);
      } finally {
        setIsLoading(false);
      }
    };

    checkTheme();

    // Слушаем изменения системной темы как fallback
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => {
      // Обновляем только если VK Bridge не предоставил тему
      if (!vkAppearance) {
        setIsLightTheme(e.matches);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [vkAppearance]); // Зависимость от vkAppearance - хук будет обновляться при изменении темы

  // Возвращаем адаптивные стили
  const getThemeStyles = () => {
    if (isLoading) {
      return {
        background: 'rgba(255, 255, 255, 0.1)',
        color: '#666666',
        textSecondary: '#888888',
        accent: '#007bff',
        card: 'rgba(255, 255, 255, 0.05)',
        border: 'rgba(255, 255, 255, 0.1)'
      };
    }

    if (isLightTheme) {
      return {
        // Светлая тема
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        backgroundDark: 'linear-gradient(135deg, #ffffff 0%, #f1f3f4 100%)',
        color: '#212529',
        textSecondary: '#6c757d',
        textTertiary: '#adb5bd',
        accent: '#007bff',
        accentHover: '#0056b3',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        card: '#ffffff',
        cardHover: '#f8f9fa',
        border: '#dee2e6',
        borderLight: '#e9ecef',
        shadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        shadowHover: '0 8px 25px rgba(0, 0, 0, 0.15)',
        
        // Специальные цвета для FakeCheck
        primary: '#007bff',
        primaryGradient: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
        successGradient: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
        warningGradient: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
        dangerGradient: 'linear-gradient(135deg, #dc3545 0%, #bd2130 100%)',
      };
    } else {
      return {
        // Тёмная тема
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
        backgroundDark: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 0%, #16213e 100%)',
        color: '#ffffff',
        textSecondary: '#7c827c',
        textTertiary: '#5a5a5a',
        accent: '#ff6600',
        accentHover: '#ff8800',
        success: '#00ff00',
        warning: '#ffaa00',
        danger: '#ff0000',
        card: 'rgba(255, 255, 255, 0.05)',
        cardHover: 'rgba(255, 255, 255, 0.1)',
        border: 'rgba(255, 255, 255, 0.1)',
        borderLight: 'rgba(255, 255, 255, 0.05)',
        shadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        shadowHover: '0 8px 25px rgba(0, 0, 0, 0.4)',
        
        // Специальные цвета для FakeCheck
        primary: '#ff6600',
        primaryGradient: 'linear-gradient(135deg, #ff6600 0%, #ff8800 100%)',
        successGradient: 'linear-gradient(135deg, #00ff00 0%, #00cc00 100%)',
        warningGradient: 'linear-gradient(135deg, #ffaa00 0%, #ff8800 100%)',
        dangerGradient: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
      };
    }
  };

  return {
    isLightTheme,
    isLoading,
    styles: getThemeStyles()
  };
};

