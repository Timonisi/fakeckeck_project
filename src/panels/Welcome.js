import { Panel, PanelHeader, Card, CardGrid, Button, Div, Title, Text, Group } from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';

export const Welcome = ({ id }) => {
  const routeNavigator = useRouteNavigator();
  const [isVisible, setIsVisible] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const { isLightTheme, styles } = useTheme();

  useEffect(() => {
    // Анимация появления контента
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    { 
      icon: '🔍', 
      title: 'Анализ профиля', 
      desc: 'Проверка подлинности аккаунта',
      gradient: isLightTheme ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      borderColor: isLightTheme ? '#2196f3' : '#00ffff',
      textColor: isLightTheme ? '#1976d2' : '#00ffff'
    },
    { 
      icon: '📊', 
      title: 'Детальная статистика', 
      desc: 'Анализ активности и контента',
      gradient: isLightTheme ? 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)' : 'linear-gradient(135deg, #0a0a0a 0%, #16213e 100%)',
      borderColor: isLightTheme ? '#4caf50' : '#00ff00',
      textColor: isLightTheme ? '#388e3c' : '#00ff00'
    },
    { 
      icon: '⚡', 
      title: 'Быстрая проверка', 
      desc: 'Мгновенный результат',
      gradient: isLightTheme ? 'linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%)' : 'linear-gradient(135deg, #0a0a0a 0%, #2e1a1a 100%)',
      borderColor: isLightTheme ? '#ff9800' : '#ff6600',
      textColor: isLightTheme ? '#f57c00' : '#ff6600'
    },
    { 
      icon: '🛡️', 
      title: 'Безопасность', 
      desc: 'Защита от фейковых аккаунтов',
      gradient: isLightTheme ? 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)' : 'linear-gradient(135deg, #0a0a0a 0%, #1e2a1a 100%)',
      borderColor: isLightTheme ? '#e91e63' : '#ff00ff',
      textColor: isLightTheme ? '#c2185b' : '#ff00ff'
    }
  ];

  return (
    <Panel id={id}>
      <PanelHeader 
        style={{ 
          background: styles.primaryGradient,
          color: isLightTheme ? '#ffffff' : styles.primary,
          fontSize: '18px',
          fontWeight: 'bold',
          textShadow: isLightTheme ? 'none' : `0 0 10px ${styles.primary}`,
          borderBottom: `2px solid ${styles.primary}`,
          boxShadow: isLightTheme ? styles.shadow : `0 0 15px ${styles.primary}40`
        }}
      >
        FakeCheck
      </PanelHeader>
      
      <div 
        style={{
          background: styles.backgroundDark,
          minHeight: '100vh',
          padding: '20px 0'
        }}
      >
        <Group>
          <CardGrid size="l">
            <Card 
              mode="shadow" 
              className="glass-effect shadow-strong hover-lift"
              style={{
                transform: isVisible ? 'translateY(0)' : 'translateY(50px)',
                opacity: isVisible ? 1 : 0,
                transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <Div style={{ textAlign: 'center', padding: '24px' }}>
                {/* Анимированный заголовок */}
                <div style={{
                  marginBottom: '24px',
                  transform: isVisible ? 'scale(1)' : 'scale(0.8)',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s'
                }}>
                  <div 
                    className="animate-pulse"
                    style={{
                      fontSize: '48px',
                      marginBottom: '16px'
                    }}
                  >
                    🔍
                  </div>
                  <Title 
                    level="1" 
                    style={{ 
                      fontSize: '32px',
                      fontWeight: 'bold',
                      marginBottom: '8px',
                      color: '#000000'
                    }}
                  >
                    FakeCheck
                  </Title>
                  <Text style={{ 
                    fontSize: '16px', 
                    color: styles.textSecondary,
                    fontStyle: 'italic'
                  }}>
                    Ваш защитник от фейковых аккаунтов
                  </Text>
                </div>
                
                {/* Возможности */}
                <div style={{
                  marginBottom: '32px',
                  transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                  opacity: isVisible ? 1 : 0,
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.6s'
                }}>
                  <Text 
                    style={{ 
                      textAlign: 'center', 
                      marginBottom: '24px',
                      color: styles.primary,
                      fontSize: '16px',
                      fontWeight: 'bold',
                      textShadow: isLightTheme ? 'none' : `0 0 10px ${styles.primary}`
                    }}
                  >
                    Мы используем передовые технологии для анализа профилей ВКонтакте
                  </Text>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    {features.map((feature, index) => (
                      <div 
                        key={index}
                        className="shadow-medium hover-scale"
                        style={{
                          background: feature.gradient,
                          border: `2px solid ${feature.borderColor}`,
                          boxShadow: isLightTheme 
                            ? `0 4px 15px ${feature.borderColor}30` 
                            : `0 0 10px ${feature.borderColor}40, inset 0 0 10px ${feature.borderColor}20`,
                          padding: '16px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          color: feature.textColor,
                          transform: isVisible ? 'scale(1)' : 'scale(0.8)',
                          opacity: isVisible ? 1 : 0,
                          transition: `all 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${0.8 + index * 0.1}s`
                        }}
                      >
                        <div 
                          className="animate-float"
                          style={{ 
                            fontSize: '24px', 
                            marginBottom: '8px',
                            animationDelay: `${index * 0.5}s`,
                            textShadow: isLightTheme ? 'none' : `0 0 10px ${feature.textColor}`
                          }}
                        >
                          {feature.icon}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: 'bold',
                          marginBottom: '4px',
                          textShadow: isLightTheme ? 'none' : `0 0 5px ${feature.textColor}`
                        }}>
                          {feature.title}
                        </div>
                        <div style={{ 
                          fontSize: '10px', 
                          opacity: 0.8,
                          textShadow: isLightTheme ? 'none' : `0 0 3px ${feature.textColor}`
                        }}>
                          {feature.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Кнопка */}
                <div style={{
                  transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                  opacity: isVisible ? 1 : 0,
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 1s'
                }}>
                  <Button 
                    stretched 
                    size="l" 
                    mode="primary" 
                    onClick={() => routeNavigator.push('home')}
                    onMouseEnter={() => setButtonHover(true)}
                    onMouseLeave={() => setButtonHover(false)}
                    className="hover-scale"
                    style={{
                      background: buttonHover 
                        ? styles.accentHover 
                        : styles.primary,
                      border: 'none',
                      borderRadius: '25px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      padding: '16px 32px',
                      color: isLightTheme ? '#ffffff' : '#000000',
                      transform: buttonHover ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: buttonHover 
                        ? styles.shadowHover 
                        : styles.shadow
                    }}
                  >
                    🚀 Начать проверку
                  </Button>
                  
                </div>

                {/* Дополнительная информация */}
                <div 
                  className="animate-fade-in-up"
                  style={{
                    marginTop: '24px',
                    padding: '16px',
                    background: isLightTheme ? 'rgba(0, 123, 255, 0.1)' : 'rgba(102, 126, 234, 0.1)',
                    borderRadius: '12px',
                    transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 1.2s'
                  }}
                >
                  <Text style={{ 
                    fontSize: '12px', 
                    color: styles.textSecondary,
                    textAlign: 'center'
                  }}>
                    ⚡ Проверка занимает менее 30 секунд • 🔒 Ваши данные в безопасности
                  </Text>
                </div>
              </Div>
            </Card>
          </CardGrid>
        </Group>
      </div>
    </Panel>
  );
};

Welcome.propTypes = {
  id: PropTypes.string.isRequired,
}; 