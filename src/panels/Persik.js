import { Panel, PanelHeader, PanelHeaderBack, Group, Div, Title, Text, Avatar, Cell, Card, CardGrid, Progress, Button } from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { DEFAULT_VIEW_PANELS } from '../routes';
import vkBridge from '@vkontakte/vk-bridge';
import { useTheme } from '../hooks/useTheme';

export const Persik = ({ id }) => {
  const routeNavigator = useRouteNavigator();
  const { isLightTheme, styles } = useTheme();
  const [data, setData] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAdditionalChecksModal, setShowAdditionalChecksModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [additionalChecks, setAdditionalChecks] = useState([]);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isAnswerLoading, setIsAnswerLoading] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  
  // Функция для показа баннерной рекламы
  const showBannerAd = () => {
    vkBridge.send('VKWebAppShowBannerAd', {
      banner_location: 'bottom'
    })
    .then((data) => { 
      if (data.result) {
        // Баннерная реклама отобразилась
      }
    })
    .catch((error) => {
      // Ошибка показа баннерной рекламы
    });
  };

  // Функция для открытия сообщества
  const openCommunity = () => {
    vkBridge.send('VKWebAppOpenURL', {
      url: 'https://vk.com/FakeCheeck'
    })
    .then((data) => {
      // Сообщество открыто
    })
    .catch((error) => {
      // Ошибка открытия сообщества
      // Fallback - открываем в новой вкладке
      window.open('https://vk.com/FakeCheeck', '_blank');
    });
  };

  // Функция для отправки обратной связи
  const sendFeedback = async (isCorrect) => {
    setIsFeedbackLoading(true);
    try {
      // Отправка обратной связи
      
      // Отправляем обратную связь на сервер
      const response = await fetch('https://fakecheck-b56o.onrender.com/save-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify({
          user_id: data.user_id,
          is_correct: isCorrect
        })
      });

      if (response.ok) {
        // Обратная связь отправлена на сервер
        
        // Если ответ верный, показываем сообщение благодарности
        if (isCorrect) {
          // Спасибо за ответ, вы нам помогаете
          setFeedbackSubmitted(true);
          return;
        }
        
        // Если ответ неверный, показываем предложение помочь
        // Показываем предложение помочь
        // Спасибо за ответ и не хотите ли помочь с разметкой данных
        setFeedbackSubmitted(true);
        setShowHelpModal(true);
      } else {
        // Ошибка отправки на сервер
        // Произошла ошибка при отправке обратной связи. Попробуйте еще раз.
      }
      
    } catch (error) {
      // Ошибка обработки обратной связи
      // Произошла ошибка при обработке обратной связи. Попробуйте еще раз.
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  // Функция для обработки согласия помочь
  const handleHelpAgreement = async () => {
    try {
      // Проверяем, не участвовал ли пользователь в дополнительных проверках сегодня
      const today = new Date().toDateString();
      const lastAdditionalChecksDate = localStorage.getItem('lastAdditionalChecksDate');
      
      if (lastAdditionalChecksDate === today) {
        // Вы уже участвовали в дополнительных проверках сегодня. Попробуйте завтра!
        setShowHelpModal(false);
        return;
      }
      
      // Пользователь согласился помочь, генерируем дополнительные проверки
      setShowHelpModal(false);
      generateAdditionalChecks();
      setShowAdditionalChecksModal(true);
    } catch (error) {
      // Ошибка проверки ограничений
      setShowHelpModal(false);
    }
  };

  // Функция для обработки отказа помочь
  const handleHelpDecline = () => {
    // Пользователь отказался помочь
    setShowHelpModal(false);
  };

  // Функция для генерации дополнительных проверок
  const generateAdditionalChecks = () => {
    const checks = [];
    for (let i = 0; i < 5; i++) {
      const randomId = Math.floor(Math.random() * 624885153) + 1;
      checks.push({
        id: randomId,
        url: `https://vk.com/id${randomId}`,
        userAnswer: null
      });
    }
    setAdditionalChecks(checks);
    setCurrentCheckIndex(0);
    setUserAnswers({});
  };

  // Функция для ответа на дополнительную проверку
  const answerAdditionalCheck = async (answer) => {
    setIsAnswerLoading(true);
    const currentCheck = additionalChecks[currentCheckIndex];
    
    try {
      // Сохраняем ответ на сервере
      const response = await fetch('https://fakecheck-b56o.onrender.com/save-additional-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify({
          user_id: data.user_id,
          check_id: currentCheck.id,
          answer: answer
        })
      });

      if (response.ok) {
        // Ответ сохранён
        
        if (currentCheckIndex < additionalChecks.length - 1) {
          // Переходим к следующему вопросу
          setCurrentCheckIndex(currentCheckIndex + 1);
        } else {
          // Все 5 вопросов отвечены, завершаем проверки
          await finishAdditionalChecks();
        }
      } else {
        // Ошибка сохранения ответа
      }
    } catch (error) {
      // Ошибка сохранения ответа
    } finally {
      setIsAnswerLoading(false);
    }
  };

  // Функция для завершения дополнительных проверок
  const finishAdditionalChecks = async () => {
    try {
      // Отправляем запрос на завершение проверок
      const response = await fetch('https://fakecheck-b56o.onrender.com/finish-additional-checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify({
          user_id: data.user_id
        })
      });

      if (response.ok) {
        // Дополнительные проверки завершены
        setShowAdditionalChecksModal(false);
        
        // Награждаем пользователя дополнительными попытками через VK Storage
        try {
          // Получаем текущее количество попыток из VK Storage
          const storageResponse = await vkBridge.send('VKWebAppStorageGet', {
            keys: ['daily_attempts']
          });
          
          let currentAttempts = 5; // По умолчанию
          if (storageResponse.keys && storageResponse.keys.length > 0) {
            const attemptsKey = storageResponse.keys.find(key => key.key === 'daily_attempts');
            if (attemptsKey && attemptsKey.value) {
              currentAttempts = parseInt(attemptsKey.value);
            }
          }
          
          // Добавляем 3 попытки (максимум 5)
          const newAttempts = Math.min(currentAttempts + 3, 5);
          
          // Сохраняем в VK Storage
          await vkBridge.send('VKWebAppStorageSet', {
            key: 'daily_attempts',
            value: newAttempts.toString()
          });
          
          // Сохраняем дату участия в дополнительных проверках
          const today = new Date().toDateString();
          localStorage.setItem('lastAdditionalChecksDate', today);
          
          // Попытки обновлены
          // Спасибо! Вы получили +3 дополнительных попыток!
        } catch (storageError) {
          // Ошибка обновления попыток в VK Storage
          // Спасибо! Попытки будут добавлены при следующем запуске приложения.
        }
      } else {
        // Ошибка завершения проверок
      }
    } catch (error) {
      // Ошибка завершения проверок
    }
  };
  
  useEffect(() => {
    // Persik panel mounted
    
    // Показываем баннерную рекламу при загрузке страницы
    showBannerAd();
    
    try {
      const raw = sessionStorage.getItem('analysisResult');
      // Raw data from sessionStorage получены
      if (raw) {
        const parsedData = JSON.parse(raw);
        // Parsed data получены
        setData(parsedData);
      }
    } catch (error) {
      // Error parsing sessionStorage data
    }
  }, []);

  // Функция для определения статуса пользователя
  const getUserStatus = (data) => {
    // Проверяем закрытый аккаунт
    if (data.is_closed === true || data.result === '🔒 Закрытый аккаунт') {
      return {
        type: 'closed',
        title: '🔒 Закрытый аккаунт',
        message: data.message || 'Этот профиль закрыт для просмотра. Мы не можем проанализировать закрытые аккаунты.',
        color: isLightTheme ? '#6c757d' : '#888888',
        bgColor: isLightTheme ? 'rgba(108, 117, 125, 0.1)' : 'rgba(136, 136, 136, 0.1)',
        borderColor: isLightTheme ? '#6c757d' : '#888888',
        showCriteria: false
      };
    }

    // Проверяем верифицированный аккаунт
    if (data.verified === true || data.result === '✅ Подтверждён') {
      return {
        type: 'verified',
        title: '✅ Подтверждённый аккаунт',
        message: data.message || 'Пользователь подтверждён модераторами VK и заслуживает доверия.',
        color: isLightTheme ? '#28a745' : '#00ff00',
        bgColor: isLightTheme ? 'rgba(40, 167, 69, 0.1)' : 'rgba(0, 255, 0, 0.1)',
        borderColor: isLightTheme ? '#28a745' : '#00ff00',
        showCriteria: false
      };
    }

    // Проверяем вероятность реального аккаунта
    const realProb = parseFloat(data.real_prob) || 0;
    
    if (realProb > 50) {
      return {
        type: 'real',
        title: '✅ Настоящий пользователь',
        message: 'Высокая вероятность того, что это реальный аккаунт',
        color: isLightTheme ? '#28a745' : '#00ff00',
        bgColor: isLightTheme ? 'rgba(40, 167, 69, 0.1)' : 'rgba(0, 255, 0, 0.1)',
        borderColor: isLightTheme ? '#28a745' : '#00ff00',
        showCriteria: false
      };
    } else if (realProb >= 20 && realProb <= 50) {
      return {
        type: 'suspicious',
        title: '⚠️ Подозрительный аккаунт',
        message: 'Средняя вероятность того, что это реальный аккаунт. Рекомендуется проявить осторожность.',
        color: isLightTheme ? '#ffc107' : '#ffaa00',
        bgColor: isLightTheme ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 170, 0, 0.1)',
        borderColor: isLightTheme ? '#ffc107' : '#ffaa00',
        showCriteria: true
      };
    } else {
      return {
        type: 'fake',
        title: '❌ Фейковый аккаунт',
        message: 'Высокая вероятность того, что это фейковый аккаунт',
        color: isLightTheme ? '#dc3545' : '#ff0000',
        bgColor: isLightTheme ? 'rgba(220, 53, 69, 0.1)' : 'rgba(255, 0, 0, 0.1)',
        borderColor: isLightTheme ? '#dc3545' : '#ff0000',
        showCriteria: true
      };
    }
  };

  const status = data ? getUserStatus(data) : null;

  return (
    <Panel id={id}>
      <PanelHeader 
        before={<PanelHeaderBack onClick={() => routeNavigator.replace(`/${DEFAULT_VIEW_PANELS.HOME}`)} />}
        style={{
          background: styles.primaryGradient,
          color: status?.color || (isLightTheme ? '#ffffff' : styles.primary),
          fontSize: '18px',
          fontWeight: 'bold',
          textShadow: isLightTheme ? 'none' : `0 0 10px ${status?.color || styles.primary}`,
          borderBottom: `2px solid ${status?.color || styles.primary}`,
          boxShadow: isLightTheme ? styles.shadow : `0 0 15px ${status?.color || styles.primary}40`
        }}
      >
        Результат анализа
      </PanelHeader>

      <div
        style={{
          background: styles.backgroundDark,
          minHeight: '100vh',
          padding: '20px 0'
        }}
      >
        {!data ? (
          <Group>
            <Div>
              <Text style={{ color: styles.textSecondary }}>Нет данных для отображения. Вернитесь и выполните проверку.</Text>
            </Div>
          </Group>
        ) : (
          <>
            {/* Информация о пользователе */}
            <Group>
              <Cell 
                before={<Avatar size={72} src={data.photo} />} 
                subtitle={`ID: ${data.user_id}`}
                style={{
                  background: isLightTheme ? styles.card : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  margin: '8px',
                  border: `2px solid ${status?.color}`,
                  boxShadow: isLightTheme 
                    ? `0 4px 15px ${status?.color}30` 
                    : `0 0 10px ${status?.color}40`
                }}
              >
                <Title level="2" style={{ color: styles.color, marginBottom: '4px' }}>
                  {data.first_name} {data.last_name}
                </Title>
              </Cell>
            </Group>

            {/* Статус аккаунта */}
            <Group>
              <Card 
                mode="shadow"
                style={{
                  background: status?.bgColor,
                  border: `2px solid ${status?.borderColor}`,
                  borderRadius: '16px',
                  margin: '8px',
                  boxShadow: `0 0 20px ${status?.color}40`
                }}
              >
                <Div style={{ textAlign: 'center', padding: '20px' }}>
                  <div
                    style={{
                      fontSize: '48px',
                      marginBottom: '12px',
                      animation: 'pulse 2s infinite'
                    }}
                  >
                    {status?.type === 'verified' && '✅'}
                    {status?.type === 'real' && '✅'}
                    {status?.type === 'suspicious' && '⚠️'}
                    {status?.type === 'fake' && '❌'}
                  </div>
                  
                  <Title 
                    level="2" 
                    style={{ 
                      color: status?.color, 
                      marginBottom: '8px',
                      fontSize: '20px',
                      fontWeight: 'bold'
                    }}
                  >
                    {status?.title}
                  </Title>
                  
                  <Text 
                    style={{ 
                      color: styles.textSecondary, 
                      fontSize: '16px',
                      lineHeight: '1.5',
                      opacity: 0.9
                    }}
                  >
                    {status?.message}
                  </Text>
                </Div>
              </Card>
            </Group>

            {/* Прогресс-бары (только для неверифицированных и не закрытых аккаунтов) */}
            {status?.type !== 'verified' && status?.type !== 'closed' && (
              <Group>
                <CardGrid size="l">
                  <Card 
                    mode="shadow"
                    style={{
                      background: isLightTheme ? styles.card : 'rgba(255, 255, 255, 0.05)',
                      border: isLightTheme ? `1px solid ${styles.border}` : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px'
                    }}
                  >
                    <Div>
                      <Title level="3" style={{ marginBottom: '16px', color: styles.color }}>
                        📊 Вероятности
                      </Title>
                      
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <Text style={{ color: isLightTheme ? styles.success : '#00ff00', fontSize: '14px' }}>Реальный аккаунт</Text>
                          <Text style={{ color: isLightTheme ? styles.success : '#00ff00', fontSize: '14px', fontWeight: 'bold' }}>
                            {parseFloat(data.real_prob || 0).toFixed(1)}%
                          </Text>
                        </div>
                        <Progress 
                          value={parseFloat(data.real_prob || 0)} 
                          style={{ 
                            background: isLightTheme ? styles.success : '#00ff00',
                            height: '8px',
                            borderRadius: '4px'
                          }} 
                        />
                      </div>
                      
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <Text style={{ color: isLightTheme ? styles.danger : '#ff0000', fontSize: '14px' }}>Фейковый аккаунт</Text>
                          <Text style={{ color: isLightTheme ? styles.danger : '#ff0000', fontSize: '14px', fontWeight: 'bold' }}>
                            {parseFloat(data.fake_prob || 0).toFixed(1)}%
                          </Text>
                        </div>
                        <Progress 
                          value={parseFloat(data.fake_prob || 0)} 
                          style={{ 
                            background: isLightTheme ? styles.danger : '#ff0000',
                            height: '8px',
                            borderRadius: '4px'
                          }} 
                        />
                      </div>
                    </Div>
                  </Card>
                </CardGrid>
              </Group>
            )}

            {/* Подозрительные критерии (только для подозрительных и фейковых аккаунтов) */}
            {status?.showCriteria && Array.isArray(data.suspicious_criteria) && data.suspicious_criteria.length > 0 && (
              <Group>
                <Card 
                  mode="shadow"
                  style={{
                    background: isLightTheme ? 'rgba(220, 53, 69, 0.1)' : 'rgba(255, 0, 0, 0.05)',
                    border: isLightTheme ? '1px solid rgba(220, 53, 69, 0.3)' : '1px solid rgba(255, 0, 0, 0.3)',
                    borderRadius: '12px',
                    margin: '8px'
                  }}
                >
                  <Div>
                    <Title level="3" style={{ marginBottom: '16px', color: isLightTheme ? styles.danger : '#ff0000' }}>
                      ⚠️ Подозрительные критерии
                    </Title>
                    <div>
                      {data.suspicious_criteria.map((criterion, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: isLightTheme ? 'rgba(220, 53, 69, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '8px',
                            border: isLightTheme ? '1px solid rgba(220, 53, 69, 0.2)' : '1px solid rgba(255, 0, 0, 0.2)'
                          }}
                        >
                          <Text style={{ color: styles.textSecondary, fontSize: '14px' }}>
                            • {criterion}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </Div>
                </Card>
              </Group>
            )}

            {/* Панель обратной связи */}
            {status?.type !== 'closed' && !feedbackSubmitted && (
              <Group>
                <Card 
                  mode="shadow"
                  style={{
                    background: 'rgba(255, 193, 7, 0.05)',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    borderRadius: '12px',
                    margin: '8px'
                  }}
                >
                  <Div>
                    <Title level="3" style={{ marginBottom: '16px', color: isLightTheme ? styles.warning : '#ffc107' }}>
                      🤔 Результат верный?
                    </Title>
                    <Text style={{ color: styles.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '16px' }}>
                      Помогите нам улучшить нашу систему! Ваша обратная связь поможет нам собрать больше данных 
                      и сделать анализ более точным. За каждый неверный ответ вы получите возможность проверить 
                      5 случайных аккаунтов и получить +3 дополнительных попыток!
                    </Text>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      <Button 
                        size="m" 
                        mode="primary" 
                        onClick={() => sendFeedback(true)}
                        loading={isFeedbackLoading}
                        disabled={isFeedbackLoading}
                        style={{ 
                          background: styles.successGradient,
                          color: isLightTheme ? '#ffffff' : '#000000',
                          fontWeight: 'bold',
                          borderRadius: '20px',
                          padding: '12px 24px',
                          flex: 1
                        }}
                      >
                        ✅ Верно
                      </Button>
                      <Button 
                        size="m" 
                        mode="primary" 
                        onClick={() => sendFeedback(false)}
                        loading={isFeedbackLoading}
                        disabled={isFeedbackLoading}
                        style={{ 
                          background: styles.dangerGradient,
                          color: isLightTheme ? '#ffffff' : '#000000',
                          fontWeight: 'bold',
                          borderRadius: '20px',
                          padding: '12px 24px',
                          flex: 1
                        }}
                      >
                        ❌ Неверно
                      </Button>
                    </div>
                  </Div>
                </Card>
              </Group>
            )}

            {/* Сообщение благодарности после отправки обратной связи */}
            {status?.type !== 'closed' && feedbackSubmitted && (
              <Group>
                <Card 
                  mode="shadow"
                  style={{
                    background: 'rgba(40, 167, 69, 0.05)',
                    border: '1px solid rgba(40, 167, 69, 0.3)',
                    borderRadius: '12px',
                    margin: '8px'
                  }}
                >
                  <Div style={{ textAlign: 'center', padding: '20px' }}>
                    <div
                      style={{
                        fontSize: '48px',
                        marginBottom: '12px',
                        animation: 'pulse 2s infinite'
                      }}
                    >
                      🙏
                    </div>
                    <Title level="3" style={{ marginBottom: '8px', color: isLightTheme ? styles.success : '#28a745' }}>
                      Спасибо за ответ!
                    </Title>
                    <Text style={{ color: styles.textSecondary, fontSize: '16px', lineHeight: '1.5' }}>
                      Ваша обратная связь помогает нам улучшать систему анализа
                    </Text>
                  </Div>
                </Card>
              </Group>
            )}

            {/* Блок контактов для связи */}
            <Group>
              <Card 
                mode="shadow"
                style={{
                  background: 'rgba(0, 123, 255, 0.05)',
                  border: '1px solid rgba(0, 123, 255, 0.3)',
                  borderRadius: '12px',
                  margin: '8px'
                }}
              >
                <Div>
                  <Title level="3" style={{ marginBottom: '16px', color: styles.primary }}>
                    📞 Нужна помощь?
                  </Title>
                  <Text style={{ color: styles.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '16px' }}>
                    Если вы считаете, что результат анализа неверный, или у вас есть вопросы по работе приложения, 
                    свяжитесь с нашим сообществом. Мы всегда готовы помочь!
                  </Text>
                  <Button 
                    size="m" 
                    mode="primary" 
                    onClick={openCommunity}
                    style={{ 
                      background: styles.primaryGradient,
                      color: isLightTheme ? '#ffffff' : '#000000',
                      fontWeight: 'bold',
                      borderRadius: '20px',
                      padding: '12px 24px'
                    }}
                  >
                    👥 Написать в сообщество
                  </Button>
                  <div style={{ marginTop: '12px' }}>
                    <Text style={{ color: styles.primary, fontSize: '12px' }}>
                      💬 Сообщество: vk.com/FakeCheeck
                    </Text>
                  </div>
                </Div>
              </Card>
            </Group>
          </>
        )}

        {/* Модальное окно предложения помочь */}
        {showHelpModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <Card 
              mode="shadow"
              style={{
                background: styles.backgroundDark,
                border: `2px solid ${isLightTheme ? styles.warning : '#ffc107'}`,
                borderRadius: '16px',
                maxWidth: '400px',
                width: '100%'
              }}
            >
              <Div>
                <Title level="2" style={{ marginBottom: '16px', color: isLightTheme ? styles.warning : '#ffc107', textAlign: 'center' }}>
                  🤝 Помогите улучшить наш сервер
                </Title>
                <Text style={{ color: styles.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '20px', textAlign: 'center' }}>
                  Мы хотим сделать анализ более точным! Помогите нам разметить данные, 
                  проверив несколько случайных аккаунтов. Это займет всего несколько минут.
                </Text>
                
                <div style={{ 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  marginBottom: '20px',
                  border: '1px solid rgba(255, 193, 7, 0.3)'
                }}>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Button 
                    size="m" 
                    mode="primary" 
                    onClick={handleHelpAgreement}
                    style={{ 
                      background: styles.successGradient,
                      color: isLightTheme ? '#ffffff' : '#000000',
                      fontWeight: 'bold',
                      borderRadius: '20px'
                    }}
                  >
                    ✅ Да, помогу!
                  </Button>
                  <Button 
                    size="m" 
                    mode="primary" 
                    onClick={handleHelpDecline}
                    style={{ 
                      background: isLightTheme ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' : 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                      color: isLightTheme ? '#ffffff' : '#000000',
                      fontWeight: 'bold',
                      borderRadius: '20px'
                    }}
                  >
                    ❌ Не сейчас
                  </Button>
                </div>
              </Div>
            </Card>
          </div>
        )}

        {/* Модальное окно дополнительных проверок */}
        {showAdditionalChecksModal && additionalChecks.length > 0 && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <Card 
              mode="shadow"
              style={{
                background: styles.backgroundDark,
                border: `2px solid ${isLightTheme ? styles.warning : '#ffc107'}`,
                borderRadius: '16px',
                maxWidth: '400px',
                width: '100%'
              }}
            >
              <Div>
                <Title level="2" style={{ marginBottom: '16px', color: isLightTheme ? styles.warning : '#ffc107', textAlign: 'center' }}>
                  🔍 Дополнительная проверка
                </Title>
                <Text style={{ color: styles.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '20px', textAlign: 'center' }}>
                  Проверка {currentCheckIndex + 1} из {additionalChecks.length}
                </Text>
                
                <div style={{ 
                  background: isLightTheme ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 193, 7, 0.1)', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  marginBottom: '20px',
                  border: `1px solid ${isLightTheme ? 'rgba(255, 193, 7, 0.3)' : 'rgba(255, 193, 7, 0.3)'}`
                }}>
                  <Text style={{ color: isLightTheme ? styles.warning : '#ffc107', fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '8px' }}>
                    ID: {additionalChecks[currentCheckIndex].id}
                  </Text>
                  <Button 
                    size="m" 
                    mode="primary" 
                    onClick={() => window.open(additionalChecks[currentCheckIndex].url, '_blank')}
                    style={{ 
                      background: styles.primaryGradient,
                      color: isLightTheme ? '#ffffff' : '#000000',
                      fontWeight: 'bold',
                      borderRadius: '20px',
                      width: '100%',
                      marginBottom: '12px'
                    }}
                  >
                    🔗 Открыть профиль
                  </Button>
                </div>

                <Text style={{ color: styles.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '16px', textAlign: 'center' }}>
                  Какой это аккаунт?
                </Text>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Button 
                    size="m" 
                    mode="primary" 
                    onClick={() => answerAdditionalCheck('real')}
                    loading={isAnswerLoading}
                    disabled={isAnswerLoading}
                    style={{ 
                      background: styles.successGradient,
                      color: isLightTheme ? '#ffffff' : '#000000',
                      fontWeight: 'bold',
                      borderRadius: '20px'
                    }}
                  >
                    ✅ Реальный аккаунт
                  </Button>
                  <Button 
                    size="m" 
                    mode="primary" 
                    onClick={() => answerAdditionalCheck('fake')}
                    loading={isAnswerLoading}
                    disabled={isAnswerLoading}
                    style={{ 
                      background: styles.dangerGradient,
                      color: isLightTheme ? '#ffffff' : '#000000',
                      fontWeight: 'bold',
                      borderRadius: '20px'
                    }}
                  >
                    ❌ Фейковый аккаунт
                  </Button>
                  <Button 
                    size="m" 
                    mode="primary" 
                    onClick={() => answerAdditionalCheck('closed')}
                    loading={isAnswerLoading}
                    disabled={isAnswerLoading}
                    style={{ 
                      background: isLightTheme ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' : 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                      color: isLightTheme ? '#ffffff' : '#000000',
                      fontWeight: 'bold',
                      borderRadius: '20px'
                    }}
                  >
                    🔒 Закрытый аккаунт
                  </Button>
                </div>
              </Div>
            </Card>
          </div>
        )}
      </div>
    </Panel>
  );
};

Persik.propTypes = {
  id: PropTypes.string.isRequired,
};
