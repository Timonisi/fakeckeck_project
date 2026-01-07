import { Panel, PanelHeader, Header, Button, Group, Cell, Div, Avatar, FormItem, Input, Card, CardGrid, Title, Text, Tabs, TabsItem } from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import { DEFAULT_VIEW_PANELS } from '../routes';
import { useTheme } from '../hooks/useTheme';

const API_URL = 'https://fakecheck-b56o.onrender.com';
const SUBSCRIPTION_API_URL = 'https://customqr.pythonanywhere.com';
const SUBSCRIPTION_ITEM = 'sale_item_subscription_1';
const SUBSCRIPTION_STORAGE_KEY = 'fakecheck_subscription_seen';

export const Home = ({ id, fetchedUser }) => {
  const { photo_200, city, first_name, last_name } = { ...fetchedUser };
  const routeNavigator = useRouteNavigator();
  const { isLightTheme, styles } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState('global'); // 'global' или 'friends'
  const [isVisible, setIsVisible] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [factIndex, setFactIndex] = useState(0);
  const factsTimerRef = useRef(null);
  const [showFactsModal, setShowFactsModal] = useState(false);
  const [shuffledFacts, setShuffledFacts] = useState([]);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [showClosedAccountModal, setShowClosedAccountModal] = useState(false);
  const [closedAccountData, setClosedAccountData] = useState(null);
  const [dailyAttempts, setDailyAttempts] = useState(null); // Остаток попыток с бэка
  const [dailyLimit, setDailyLimit] = useState(null);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [launchParams, setLaunchParams] = useState(null);
  const [launchParamsLoaded, setLaunchParamsLoaded] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [isJoiningCommunity, setIsJoiningCommunity] = useState(false);
  const [isInFavorites, setIsInFavorites] = useState(false);
  const [isCommunityJoined, setIsCommunityJoined] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyData, setSurveyData] = useState({
    accuracy: '',
    features: [],
    suggestions: ''
  });
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [inputWarning, setInputWarning] = useState('');
  const [subscriptionMemory, setSubscriptionMemory] = useState({ requireVotes: false, activated: 0, cancelled: 0 });
  const [showSubscriptionInfoModal, setShowSubscriptionInfoModal] = useState(false);
  const [showSubscriptionPaymentModal, setShowSubscriptionPaymentModal] = useState(false);
  const [isCheckingSubscriptionMemory, setIsCheckingSubscriptionMemory] = useState(false);
  const subscriptionMarkedRef = useRef(false);

  // Функция для перемешивания массива (алгоритм Фишера-Йейтса)
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Показываем рекламу и просим бэкенд выдать бонусную попытку
  const showAdForExtraAttempt = async () => {
    if (isAdLoading) return;
    setIsAdLoading(true);
    try {
      const checkResponse = await vkBridge.send('VKWebAppCheckNativeAds', {
        ad_format: 'interstitial'
      });
      if (!checkResponse?.result) return;

      const adResponse = await vkBridge.send('VKWebAppShowNativeAds', {
        ad_format: 'interstitial'
      });

      if (adResponse?.result) {
        await grantBonusAttempt();
        setShowLimitModal(false);
      }
    } catch (error) {
      // Игнорируем ошибку показа рекламы
    } finally {
      setIsAdLoading(false);
    }
  };

  // Функции для работы с VK Storage
  const loadFromStorage = async () => {
    try {
      const response = await vkBridge.send('VKWebAppStorageGet', {
        keys: ['is_in_favorites', 'is_community_joined']
      });
      
      if (response.keys) {
        // Загружаем статус избранного
        const favoritesKey = response.keys.find(key => key.key === 'is_in_favorites');
        if (favoritesKey && favoritesKey.value === 'true') {
          setIsInFavorites(true);
        }
        
        // Загружаем статус сообщества
        const communityKey = response.keys.find(key => key.key === 'is_community_joined');
        if (communityKey && communityKey.value === 'true') {
          setIsCommunityJoined(true);
        }
      }
    } catch (error) {
      // Ошибка загрузки из VK Storage
    }
  };

  const readSubscriptionMemoryFromStorage = async () => {
    try {
      const response = await vkBridge.send('VKWebAppStorageGet', {
        keys: [SUBSCRIPTION_STORAGE_KEY]
      });
      if (response.keys) {
        const key = response.keys.find((k) => k.key === SUBSCRIPTION_STORAGE_KEY);
        if (key && key.value) {
          const parsed = JSON.parse(key.value);
          if (parsed && typeof parsed === 'object') {
            return {
              activated: Boolean(parsed.activated),
              ts: parsed.ts || Date.now()
            };
          }
        }
      }
    } catch (_) {}
    return { activated: false };
  };

  const writeSubscriptionMemoryToStorage = async () => {
    try {
      await vkBridge.send('VKWebAppStorageSet', {
        key: SUBSCRIPTION_STORAGE_KEY,
        value: JSON.stringify({ activated: true, ts: Date.now() })
      });
    } catch (_) {}
  };

  const normalizeAttemptValue = (value) => {
    if (typeof value !== 'number') return null;
    if (value >= 1_000_000) return Infinity;
    return Math.max(0, value);
  };

  const applyAttemptData = (data) => {
    const remaining = normalizeAttemptValue(data?.remaining_attempts);
    const limit = normalizeAttemptValue(data?.daily_limit);
    if (remaining !== null) {
      setDailyAttempts(remaining);
    }
    if (limit !== null) {
      setDailyLimit(limit);
    }
  };

  const grantBonusAttempt = async () => {
    if (!launchParamsLoaded || !launchParams) return null;
    if (subscriptionActive) {
      // При активной подписке просто возвращаем бесконечный запас
      setDailyAttempts(Infinity);
      setDailyLimit(Infinity);
      return { remaining_attempts: Infinity, daily_limit: Infinity };
    }
    try {
      const response = await fetch(`${API_URL}/bonus-attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vk_params: launchParams })
      });
      if (response.ok) {
        const data = await response.json();
        applyAttemptData(data);
        return data;
      }
    } catch (_) {
      return null;
    }
    return null;
  };

  const loadLaunchParams = async () => {
    try {
      const params = await vkBridge.send('VKWebAppGetLaunchParams');
      setLaunchParams(params);
    } catch (error) {
      // Fallback к query-параметрам из URL
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const raw = {};
        searchParams.forEach((value, key) => {
          if (key.startsWith('vk_') || key === 'sign') {
            raw[key] = value;
          }
        });
        if (Object.keys(raw).length > 0) {
          setLaunchParams(raw);
        }
      } catch (_) {}
    } finally {
      setLaunchParamsLoaded(true);
    }
  };

  const fetchAttempts = async () => {
    if (!launchParamsLoaded || !launchParams) return;
    if (subscriptionActive) {
      setDailyAttempts(Infinity);
      setDailyLimit(Infinity);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vk_params: launchParams })
      });
      if (response.ok) {
        const attemptData = await response.json();
        applyAttemptData(attemptData);
      }
    } catch (_) {
      // Ошибка получения лимитов не критична для UX
    }
  };

  const fetchSubscriptionStatus = async () => {
    if (!launchParamsLoaded || !launchParams) return;
    setIsSubscriptionLoading(true);
    setSubscriptionError('');
    try {
      const response = await fetch(`${SUBSCRIPTION_API_URL}/subscription/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vk_params: launchParams })
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
        setSubscriptionMessage('');
        if (data?.memory) {
          setSubscriptionMemory((prev) => ({
            ...prev,
            requireVotes: Boolean(data.memory.require_votes),
            activated: data.memory.activated ?? prev.activated,
            cancelled: data.memory.cancelled ?? prev.cancelled,
            lastStatus: data.memory.last_status || prev.lastStatus
          }));
          if (data?.memory?.require_votes) {
            subscriptionMarkedRef.current = true;
          }
        }
      } else {
        setSubscriptionError('Не удалось получить статус подписки');
      }
    } catch (error) {
      setSubscriptionError('Не удалось получить статус подписки');
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  const touchSubscriptionMemoryBackend = async (action = 'touch', status, subscriptionIdOverride) => {
    if (!launchParamsLoaded || !launchParams) return null;
    try {
      const response = await fetch(`${SUBSCRIPTION_API_URL}/subscription/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          status,
          subscription_id: subscriptionIdOverride,
          vk_params: launchParams
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (_) {}
    return null;
  };

  const fetchSubscriptionMemory = async () => {
    const localMemory = await readSubscriptionMemoryFromStorage();
    const base = {
      requireVotes: Boolean(localMemory.activated),
      activated: localMemory.activated ? 1 : 0,
      cancelled: 0,
    };

    if (launchParamsLoaded && launchParams) {
      try {
        const response = await fetch(`${SUBSCRIPTION_API_URL}/subscription/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vk_params: launchParams })
        });
        if (response.ok) {
          const data = await response.json();
          base.requireVotes = base.requireVotes || Boolean(data.require_votes);
          base.activated = typeof data.activated === 'number' ? data.activated : base.activated;
          base.cancelled = typeof data.cancelled === 'number' ? data.cancelled : 0;
        }
      } catch (_) {}
    }

    setSubscriptionMemory((prev) => ({ ...prev, ...base }));
    if (base.requireVotes) {
      subscriptionMarkedRef.current = true;
    }
    return base;
  };

  const rememberSubscriptionLocally = async () => {
    if (subscriptionMarkedRef.current) return;
    subscriptionMarkedRef.current = true;
    setSubscriptionMemory((prev) => ({
      ...prev,
      requireVotes: true,
      activated: Math.max(prev.activated || 0, 1)
    }));
    await writeSubscriptionMemoryToStorage();
    await touchSubscriptionMemoryBackend('touch', 'active', subscriptionData?.subscription?.subscription_id);
  };

  const applyOptimisticSubscription = (subscriptionId) => {
    const now = Date.now();
    setSubscriptionData({
      active: true,
      winter: { status_text: 'Подписка активна, бонусные проверки доступны.' },
      subscription: {
        subscription_id: subscriptionId || 'pending',
        status: 'active',
        title: 'Снежная подписка',
        photo_url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=80',
        last_event_at: Math.floor(now / 1000),
      },
    });
    setDailyAttempts(Infinity);
    setDailyLimit(Infinity);
  };

  const openSubscriptionBox = async (action, extra = {}) => {
    setIsSubscriptionLoading(true);
    setSubscriptionError('');
    try {
      const payload = { action, ...extra };
      if (action === 'create') {
        payload.item = SUBSCRIPTION_ITEM;
      }
      const result = await vkBridge.send('VKWebAppShowSubscriptionBox', payload);
      if (action === 'create') {
        applyOptimisticSubscription(result?.subscription_id);
        await rememberSubscriptionLocally();
      }
      setSubscriptionMessage(action === 'create' ? 'Покупка прошла успешно' : 'Действие выполнено');
      // Дёргаем статус сразу и с несколькими задержками, чтобы успели прилететь callback-и VK
      await fetchSubscriptionStatus();
      setTimeout(() => {
        fetchSubscriptionStatus();
      }, 100);
      setTimeout(() => {
        fetchSubscriptionStatus();
      }, 1000);
      setTimeout(() => {
        fetchSubscriptionStatus();
      }, 6000);
    } catch (error) {
      setSubscriptionError('Ошибка при работе с подпиской');
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  const handleCreateSubscription = async () => {
    await openSubscriptionBox('create');
  };

  const handleCancelSubscription = async () => {
    const subscriptionId = subscriptionData?.subscription?.subscription_id;
    if (!subscriptionId) {
      setSubscriptionError('subscription_id не найден');
      return;
    }
    await openSubscriptionBox('cancel', { subscription_id: Number(subscriptionId) || subscriptionId });
    await touchSubscriptionMemoryBackend('touch', 'cancelled', subscriptionId);
  };

  const handleSubscriptionButtonClick = () => {
    if (subscriptionActive) {
      handleCancelSubscription();
    } else {
      setShowSubscriptionInfoModal(true);
    }
  };

  const handleSubscriptionInfoConfirm = async () => {
    if (subscriptionActive) {
      setShowSubscriptionInfoModal(false);
      return;
    }
    setIsCheckingSubscriptionMemory(true);
    const memory = await fetchSubscriptionMemory();
    setIsCheckingSubscriptionMemory(false);
    setShowSubscriptionInfoModal(false);
    if (memory?.requireVotes) {
      setShowSubscriptionPaymentModal(true);
    } else {
      handleCreateSubscription();
    }
  };

  const handleSubscriptionPaymentConfirm = () => {
    setShowSubscriptionPaymentModal(false);
    handleCreateSubscription();
  };

  const subscriptionStatus = subscriptionData?.subscription?.status || (subscriptionData?.active ? 'active' : null);
  const subscriptionId = subscriptionData?.subscription?.subscription_id;
  const subscriptionActive = subscriptionStatus === 'active' || subscriptionStatus === 'chargeable';
  const subscriptionStatusText =
    subscriptionData?.winter?.status_text ||
    (subscriptionActive
      ? 'Подписка активна, бонусные проверки доступны.'
      : subscriptionMemory.requireVotes
        ? 'Повторное оформление потребует 5 голосов VK.'
        : 'Подписка не оформлена — украсьте FakeCheck снежинками!');
  const subscriptionIcon = subscriptionActive ? '🎅' : '🎄';

  const facts = [
    {
      icon: '🔐',
      title: 'Двухфакторная аутентификация',
      text: 'Использование 2FA снижает риск взлома аккаунта на 99.9%'
    },
    {
      icon: '🌐',
      title: 'Фишинг-атаки',
      text: '90% всех кибератак начинаются с фишинговых писем'
    },
    {
      icon: '📱',
      title: 'Мобильная безопасность',
      text: 'Каждый 3-й пользователь не блокирует экран телефона'
    },
    {
      icon: '🔒',
      title: 'Сильные пароли',
      text: 'Пароль из 12 символов взламывается в 62 триллиона раз дольше'
    },
    {
      icon: '⚡',
      title: 'Обновления безопасности',
      text: 'Регулярные обновления закрывают 99% известных уязвимостей'
    },
    {
      icon: '🛡️',
      title: 'Антивирусная защита',
      text: 'Современные антивирусы блокируют 99.7% вредоносного ПО'
    },
    {
      icon: '📧',
      title: 'Безопасная почта',
      text: 'Проверяйте адрес отправителя перед открытием вложений'
    },
    {
      icon: '💳',
      title: 'Финансовая безопасность',
      text: 'Никогда не вводите данные карты на подозрительных сайтах'
    },
    {
      icon: '⚡',
      title: 'Сервер нагружен',
      text: 'Подождите немного, обрабатываем данные...'
    }
  ];

  useEffect(() => {
    // Анимация появления контента
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (searchType === 'friends') {
      fetchFriends();
    }
  }, [searchType]);

  useEffect(() => {
    loadLaunchParams();
  }, []);

  useEffect(() => {
    (async () => {
      const localMemory = await readSubscriptionMemoryFromStorage();
      if (localMemory?.activated) {
        setSubscriptionMemory((prev) => ({
          ...prev,
          requireVotes: true,
          activated: Math.max(prev.activated || 0, 1)
        }));
        subscriptionMarkedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    // Ротация фактов, пока ждём ответа от бэкенда
    if (showFactsModal && shuffledFacts.length > 0) {
      factsTimerRef.current = setInterval(() => {
        setFactIndex((idx) => {
          const newIndex = idx + 1;
          // Если показали все основные факты (8), переходим к факту о загрузке сервера
          if (newIndex >= 8) {
            setShowDetailedAnalysis(true);
            return 8; // Показываем факт о загрузке сервера (индекс 8)
          }
          return newIndex;
        });
      }, 3000);
    } else if (factsTimerRef.current) {
      clearInterval(factsTimerRef.current);
      factsTimerRef.current = null;
      setFactIndex(0);
      setShowDetailedAnalysis(false);
    }
    return () => {
      if (factsTimerRef.current) {
        clearInterval(factsTimerRef.current);
        factsTimerRef.current = null;
      }
    };
  }, [showFactsModal, shuffledFacts]);

  useEffect(() => {
    loadFromStorage();
    
    // Скрываем баннерную рекламу при загрузке главной страницы
    vkBridge.send('VKWebAppHideBannerAd')
      .then((data) => { 
        if (data.result) {
          // Баннерная реклама скрыта
        }
      })
      .catch((error) => {
        // Ошибка скрытия баннерной рекламы
      });
  }, []);

  useEffect(() => {
    if (launchParamsLoaded && launchParams) {
      fetchAttempts();
      fetchSubscriptionStatus();
    }
  }, [fetchedUser?.id, launchParamsLoaded, launchParams]);

  useEffect(() => {
    if (launchParamsLoaded && launchParams) {
      fetchSubscriptionMemory();
    }
  }, [launchParamsLoaded, launchParams]);

  useEffect(() => {
    if (subscriptionActive) {
      setDailyAttempts(Infinity);
      setDailyLimit(Infinity);
    } else if (launchParamsLoaded && launchParams) {
      fetchAttempts();
    }
  }, [subscriptionActive, launchParamsLoaded, launchParams]);

  useEffect(() => {
    if (subscriptionActive && !subscriptionMarkedRef.current) {
      rememberSubscriptionLocally();
    }
  }, [subscriptionActive]);


  const fetchFriends = async () => {
    setLoading(true);
    try {
      // Сначала пробуем без токена (может не сработать, зависит от контекста)
      const response = await vkBridge.send('VKWebAppCallAPIMethod', {
        method: 'friends.get',
        params: {
          order: 'hints',
          count: 5000,
          fields: 'photo_100,first_name,last_name',
          v: '5.131',
        },
      });

      if (response.response && response.response.items) {
        setFriends(response.response.items);
      } else {
        // Переходим к варианту с токеном
        await fetchFriendsWithToken();
      }
    } catch (error) {
      await fetchFriendsWithToken();
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendsWithToken = async () => {
    const authResponse = await vkBridge.send('VKWebAppGetAuthToken', {
      app_id: 53853558,
      scope: 'friends',
    });
    if (!authResponse.access_token) throw new Error('Не удалось получить access_token');

    const tokenResponse = await vkBridge.send('VKWebAppCallAPIMethod', {
      method: 'friends.get',
      params: {
        order: 'hints',
        count: 5000,
        fields: 'photo_100,first_name,last_name',
        v: '5.131',
        access_token: authResponse.access_token,
      },
    });
    if (tokenResponse.response && tokenResponse.response.items) {
      setFriends(tokenResponse.response.items);
    } else {
      throw new Error('Неверный формат ответа при получении друзей');
    }
  };

  const extractUserId = (input) => {
    const trimmed = String(input || '').trim();
    if (!trimmed) return '';
    // Примеры допустимых форм: id123, 12345, https://vk.com/durov, vk.com/id1, durov, @dm
    const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?vk\.com\/(.+)$/i);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Обработка @dm - извлекаем ID после @dm
    const dmMatch = trimmed.match(/@dm(\d+)/i);
    if (dmMatch) {
      return dmMatch[1];
    }
    return trimmed;
  };

  const sanitizeUserId = (id) => String(id || '').replace(/[^A-Za-z0-9_-]/g, '');

  const handleSearch = async () => {
    if (searchType === 'friends') {
      if (selectedFriend) await analyzeUser(String(selectedFriend.id));
    } else {
      const raw = extractUserId(searchQuery);
      const userId = sanitizeUserId(raw);
      if (userId) await analyzeUser(userId); else setShowUserNotFoundModal(true);
    }
  };

  // Функция для проверки существования пользователя через публичную страницу VK (через прокси)
  const validateUserExists = async (userId) => true;

  const analyzeUser = async (userId) => {
    setIsSearching(true);
    setShowUserNotFoundModal(false);
    setShowLimitModal(false);

    if (!launchParamsLoaded || !launchParams) {
      setIsSearching(false);
      return;
    }
    // Показать модалку фактов и запустить ротацию
    try {
      setShuffledFacts(shuffleArray(facts));
      setShowDetailedAnalysis(false);
      setShowFactsModal(true);
    } catch(_) {}
    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, vk_params: launchParams })
      });

      if (response.status === 429) {
        const limitData = await response.json().catch(() => ({}));
        applyAttemptData(limitData);
        setShowFactsModal(false);
        setShowLimitModal(true);
        setIsSearching(false);
        return;
      }

      if (response.status === 404) {
        setShowFactsModal(false);
        setShowUserNotFoundModal(true);
        setIsSearching(false);
        return;
      }
      if (!response.ok) {
        setShowFactsModal(false);
        setIsSearching(false);
        return;
      }
      const result = await response.json();
      applyAttemptData(result);
      if (result && result.error === "Пользователь не найден") {
        setShowFactsModal(false);
        setShowUserNotFoundModal(true);
        setIsSearching(false);
        return;
      }
      // Сохраняем результат и переходим на Persik
      try {
        sessionStorage.setItem('analysisResult', JSON.stringify(result));
      } catch(_) {}
      setShowFactsModal(false);
      try {
        routeNavigator.push(`/${DEFAULT_VIEW_PANELS.PERSIK}`);
      } catch(_) {}
    } catch(e) {
      setShowFactsModal(false);
    }
    setIsSearching(false); 
  };

  // Функция для вступления в сообщество
  const handleJoinCommunity = async () => {
    setIsJoiningCommunity(true);
    
    try {
      const response = await vkBridge.send('VKWebAppJoinGroup', {
        group_id: 232031141
      });
      
      // Ответ от VK Join Group API получен
      
      if (response && response.result) {
        // Пользователь успешно подписался на сообщество
        setIsCommunityJoined(true);
        await vkBridge.send('VKWebAppStorageSet', {
          key: 'is_community_joined',
          value: 'true'
        });
        setShowCommunityModal(false);
        // Спасибо за подписку на наше сообщество! Вы будете получать обновления о новых возможностях FakeCheck.
      } else {
        // Пользователь уже подписан или произошла ошибка
        setIsCommunityJoined(true); // Считаем, что уже подписан
        await vkBridge.send('VKWebAppStorageSet', {
          key: 'is_community_joined',
          value: 'true'
        });
        setShowCommunityModal(false);
        // Спасибо за интерес к нашему сообществу!
      }
    } catch (error) {
      // Ошибка вступления в сообщество
      // Ошибка при вступлении в сообщество. Попробуйте позже.
    } finally {
      setIsJoiningCommunity(false);
    }
  };

  // Функция для добавления в избранное
  const handleAddToFavorites = async () => {
    try {
      const response = await vkBridge.send('VKWebAppAddToFavorites');
      
      // Ответ от VK AddToFavorites API получен
      
      if (response && response.result) {
        // Приложение успешно добавлено в избранное
        setIsInFavorites(true);
        await vkBridge.send('VKWebAppStorageSet', {
          key: 'is_in_favorites',
          value: 'true'
        });
        // Приложение добавлено в избранное! Теперь вы можете быстро найти его в разделе "Избранное" в VK.
      } else {
        // Приложение уже в избранном или произошла ошибка
        setIsInFavorites(true); // Считаем, что уже в избранном
        await vkBridge.send('VKWebAppStorageSet', {
          key: 'is_in_favorites',
          value: 'true'
        });
        // Приложение уже в избранном или произошла ошибка.
      }
    } catch (error) {
      // Ошибка добавления в избранное
      // Ошибка при добавлении в избранное. Попробуйте позже.
    }
  };

  // Функция для шаринга приложения
  const handleInviteFriend = async () => {
    // Функция handleInviteFriend вызвана
    
    try {
      // Отправляем запрос VKWebAppShare
      
      // Проверяем, доступен ли vkBridge
      if (!vkBridge || typeof vkBridge.send !== 'function') {
        // vkBridge недоступен
        // VK Bridge недоступен. Попробуйте перезагрузить приложение.
        return;
      }
      
      const response = await vkBridge.send('VKWebAppShare', {
        link: 'https://vk.com/app53853558'
      });
      
      // Ответ от VK WebAppShare API получен
      
      if (response && response.result) {
        // Ссылка на приложение поделена
        // Спасибо за распространение FakeCheck! Ссылка на приложение поделена.
      } else {
        // Не удалось поделиться ссылкой
        // Не удалось поделиться ссылкой. Попробуйте позже.
      }
    } catch (error) {
      // Ошибка шаринга
      // Детали ошибки получены
      // Ошибка при шаринге. Попробуйте позже.
    }
  };

  const showFriendsExplanationModal = () => {
    const message = 'Проверка друзей помогает вовремя находить фейки среди знакомых и защититься от мошенников.';
    try {
      vkBridge.send('VKWebAppShowMessageBox', {
        message,
        title: 'Зачем проверять друзей?'
      });
    } catch (error) {
      try {
        alert(message);
      } catch (_) {}
    }
  };

  // Функция для отправки опроса
  const handleSubmitSurvey = async () => {
    if (!surveyData.accuracy) {
      // Пожалуйста, оцените точность анализа
      return;
    }

    setIsSubmittingSurvey(true);
    
    try {
      const response = await fetch(`${API_URL}/submit-survey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify({
          user_id: fetchedUser?.id || 'unknown',
          accuracy: surveyData.accuracy,
          features: surveyData.features,
          suggestions: surveyData.suggestions,
          helpWithLabeling: false
        })
      });

      if (response.ok) {
        // Опрос отправлен успешно
        // Спасибо за ваш отзыв! Это поможет нам улучшить приложение.
        setShowSurveyModal(false);
        setSurveyData({
          accuracy: '',
          features: [],
          suggestions: ''
        });
      } else {
        // Ошибка отправки опроса
        // Произошла ошибка при отправке опроса. Попробуйте позже.
      }
    } catch (error) {
      // Ошибка отправки опроса
      // Произошла ошибка при отправке опроса. Попробуйте позже.
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  // Функция для обновления данных опроса
  const updateSurveyData = (field, value) => {
    setSurveyData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Функция для переключения функций
  const toggleFeature = (feature) => {
    setSurveyData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

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
        Проверка аккаунта
      </PanelHeader>
      
      <div 
        style={{
          background: styles.backgroundDark,
          minHeight: '100vh',
          padding: '20px 0'
        }}
      >
        {fetchedUser && (
          <Group 
            header={
              <Header 
                size="s" 
                style={{ color: isLightTheme ? '#17a2b8' : '#00ffff', fontSize: '14px', fontWeight: 'bold' }}
              >
                Ваш профиль
              </Header>
            }
          >
            <Cell 
              before={photo_200 && <Avatar src={photo_200} />} 
              subtitle={city?.title}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                margin: '8px',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              <span style={{ color: styles.textSecondary }}>
                {`${first_name} ${last_name}`}
              </span>
            </Cell>
            
            {/* Основные блоки - статистика, топовые функции, попыток, поддержать */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              margin: '8px' 
            }}>
              {/* Блок статуса подписки перемещён вниз в "Дополнительные функции" */}

              {/* Блок попыток */}
              <div
                className="animate-fade-in-up hover-lift"
                style={{
                  animationDelay: '0.3s',
                  background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  margin: '0',
                  border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '60px',
                  padding: '8px',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ 
                  color: styles.color, 
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'center',
                  lineHeight: '1.2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%'
                }}>
                  🎯 Попыток: {dailyAttempts !== null && dailyLimit !== null
                    ? `${dailyAttempts === Infinity ? '∞' : dailyAttempts}/${dailyLimit === Infinity ? '∞' : dailyLimit}`
                    : '...'}
                </span>
              </div>

              {/* Блок сообщества */}
              {!isCommunityJoined && (
                <div
                  className="animate-fade-in-up hover-lift"
                  style={{
                    animationDelay: '0.4s',
                    background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    margin: '0',
                    border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '60px',
                    padding: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setShowCommunityModal(true)}
                >
                  <span style={{ 
                    color: styles.color, 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    textAlign: 'center',
                    lineHeight: '1.2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%'
                  }}>
                    📢 Поддержать
                  </span>
                </div>
              )}

              {/* Блок статуса сообщества */}
              {isCommunityJoined && (
                <div
                  className="animate-fade-in-up hover-lift"
                  style={{
                    animationDelay: '0.4s',
                    background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    margin: '0',
                    border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '60px',
                    padding: '8px',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ 
                    color: styles.color, 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    textAlign: 'center',
                    lineHeight: '1.2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%'
                  }}>
                    ✅ Поддержано
                  </span>
                </div>
              )}
            </div>
          </Group>
        )}

        <Group 
          header={
            <Header 
              size="s" 
              style={{ color: styles.color, fontSize: '14px', fontWeight: '500' }}
            >
              Выберите тип поиска
            </Header>
          }
        >
          <Tabs 
            style={{
              transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
              opacity: isVisible ? 1 : 0,
              transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.4s'
            }}
          >
            <TabsItem
              selected={searchType === 'global'}
              onClick={() => setSearchType('global')}
              style={{
                background: searchType === 'global' ? (isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)') : (isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)'),
                color: styles.color,
                border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                borderRadius: '8px',
                margin: '4px',
                fontWeight: '500'
              }}
            >
              🌐 Глобальный
            </TabsItem>
            <TabsItem
              selected={searchType === 'friends'}
              onClick={() => setSearchType('friends')}
              style={{
                background: searchType === 'friends' ? (isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)') : (isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)'),
                color: styles.color,
                border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                borderRadius: '8px',
                margin: '4px',
                fontWeight: '500'
              }}
            >
              👥 Среди друзей
            </TabsItem>
          </Tabs>
        </Group>

        {searchType === 'friends' && (
          <Group>
            <Card 
              mode="shadow"
              style={{
                background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                borderRadius: '12px',
                margin: '8px',
                transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                opacity: isVisible ? 1 : 0,
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.6s'
              }}
            >
              <Div>
                <Title level="4" style={{ color: styles.color, marginBottom: '8px', fontWeight: '500' }}>
                  ℹ️ Зачем проверять друзей?
                </Title>
              <Text style={{ fontSize: '14px', color: styles.textSecondary, lineHeight: '1.5' }}>
                  Проверка друзей помогает выявить фейковые аккаунты в вашем окружении. 
                  Это особенно полезно для защиты от мошенников, которые могут выдавать себя за ваших знакомых.
                </Text>
                <Button 
                  size="s" 
                  mode="secondary" 
                  onClick={showFriendsExplanationModal}
                  style={{ 
                    marginTop: '12px',
                    background: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                    color: styles.color,
                    fontWeight: '500',
                    border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`
                  }}
                >
                  Подробнее
                </Button>
                <Button 
                  size="s" 
                  mode="secondary" 
                  onClick={handleInviteFriend}
                  style={{ 
                    marginTop: '8px',
                    marginLeft: '8px',
                    background: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                    color: styles.color,
                    fontWeight: '500',
                    border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`
                  }}
                >
                  📤 Поделиться
                </Button>
              </Div>
            </Card>
          </Group>
        )}

        {searchType === 'global' ? (
          <Group 
            header={
              <Header 
                size="s" 
                style={{ color: styles.color, fontSize: '14px', fontWeight: '500' }}
              >
                Введите ID профиля
              </Header>
            }
          >
            <FormItem>
              <Input
                placeholder="Введите ID 1, короткое имя (durov) или ссылку на профиль ВКонтакте https://vk.com/id1"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  const hasIllegal = /[^A-Za-z0-9_\/-:\/]/.test(val);
                  const hasColonOrSlash = /[:\/]/.test(val);
                  const hasScheme = val.includes('://');
                  if (hasIllegal || (hasColonOrSlash && !hasScheme)) {
                    setInputWarning("Допустимы английские буквы, цифры `_` `-` или ссылка с '://'");
                  } else {
                    setInputWarning('');
                  }
                }}
                style={{
                  background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                  borderRadius: '8px',
                  color: styles.color
                }}
              />
              {inputWarning && (
                <Text style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '6px' }}>{inputWarning}</Text>
              )}
            </FormItem>
            <Div>
              <Button 
                stretched 
                size="l" 
                mode="primary" 
                onClick={handleSearch}
                loading={isSearching}
                disabled={!searchQuery.trim()}
                style={{
                  background: isSearching 
                    ? (isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)')
                    : (isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'),
                  border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)'}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '16px 32px',
                  color: styles.color,
                  transform: isVisible ? 'scale(1)' : 'scale(0.98)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSearching ? '🔍 Проверяем...' : '🌐 Проверить аккаунт'}
              </Button>
            </Div>
          </Group>
        ) : (
          <Group 
            header={
              <Header 
                size="s" 
                style={{ color: styles.color, fontSize: '14px', fontWeight: '500' }}
              >
                Выберите друга для проверки
              </Header>
            }
          >
            {loading ? (
              <Div style={{ textAlign: 'center', padding: '40px' }}>
                <Text style={{ color: styles.color, fontSize: '16px' }}>
                  🔄 Загружаем список друзей...
                </Text>
              </Div>
            ) : friends.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {friends.map((friend) => (
                  <Cell
                    key={friend.id}
                    before={<Avatar src={friend.photo_100} />}
                    onClick={() => setSelectedFriend(friend)}
                    style={{
                      background: selectedFriend?.id === friend.id 
                        ? (isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)')
                        : (isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)'),
                      borderRadius: '8px',
                      margin: '4px',
                      border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ color: styles.color }}>
                      {`${friend.first_name} ${friend.last_name}`}
                    </span>
                  </Cell>
                ))}
              </div>
            ) : (
              <Div style={{ textAlign: 'center', padding: '20px' }}>
                <Text style={{ color: styles.danger, fontSize: '14px' }}>
                  ❌ Не удалось загрузить список друзей
                </Text>
              </Div>
            )}
            
            {selectedFriend && (
              <Div>
                <Button 
                  stretched 
                  size="l" 
                  mode="primary" 
                  onClick={handleSearch}
                  loading={isSearching}
                  style={{
                    background: isSearching 
                      ? (isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)')
                      : (isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'),
                    border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)'}`,
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '500',
                    padding: '16px 32px',
                    color: styles.color,
                    transform: isVisible ? 'scale(1)' : 'scale(0.98)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isSearching ? '🔍 Проверяем...' : `👥 Проверить ${selectedFriend.first_name}`}
                </Button>
              </Div>
            )}
          </Group>
        )}

        <Group 
          header={
            <Header 
              size="s" 
              style={{ color: styles.color, fontSize: '14px', fontWeight: '500' }}
            >
              Как это работает
            </Header>
          }
        >
          <CardGrid size="l">
            <Card 
              mode="shadow"
              className="glass-effect shadow-strong hover-lift"
              style={{
                transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                opacity: isVisible ? 1 : 0,
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.8s',
                background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`
              }}
            >
              <Div>
                <Title level="3" style={{ marginBottom: '8px', color: styles.color, fontWeight: '500' }}>
                  🔍 Анализ профиля
                </Title>
                <Text style={{ fontSize: '14px', color: styles.textSecondary, lineHeight: '1.5' }}>
                  Мы анализируем различные параметры аккаунта, включая дату регистрации, 
                  активность, качество контента и другие факторы для определения подлинности профиля.
                </Text>
              </Div>
            </Card>
          </CardGrid>
        </Group>

        {searchType === 'global' && (
          <Group 
            header={
              <Header 
                size="s" 
                style={{ color: styles.color, fontSize: '14px', fontWeight: '500' }}
              >
                Примеры проверки
              </Header>
            }
          >
            <Div>
              <Button 
                stretched 
                size="m" 
                mode="secondary" 
                onClick={() => setSearchQuery('durov')}
                style={{ 
                  marginBottom: '8px',
                  background: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  color: styles.color,
                  fontWeight: '500',
                  border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`
                }}
              >
                Проверить @durov
              </Button>
              <Button 
                stretched 
                size="m" 
                mode="secondary" 
                onClick={() => setSearchQuery('dm')}
                style={{
                  background: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  color: styles.color,
                  fontWeight: '500',
                  border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`
                }}
              >
                Проверить @dm
              </Button>
            </Div>
          </Group>
        )}
      </div>
      
      {/* Модальное окно с фактами */}
      {showFactsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: isLightTheme ? '#ffffff' : 'rgba(30, 30, 30, 0.95)',
              borderRadius: '16px',
              padding: '30px',
              maxWidth: '400px',
              width: '100%',
              border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
              boxShadow: isLightTheme ? '0 4px 20px rgba(0, 0, 0, 0.1)' : '0 4px 20px rgba(0, 0, 0, 0.3)',
              animation: 'fadeInUp 0.5s ease-out'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '48px',
                  marginBottom: '10px'
                }}
              >
                {shuffledFacts[factIndex]?.icon}
              </div>
              <Title
                level="2"
                style={{
                  color: styles.color,
                  marginBottom: '10px',
                  fontSize: '20px',
                  fontWeight: '500'
                }}
              >
                {shuffledFacts[factIndex]?.title}
              </Title>
              <Text
                style={{
                  color: isLightTheme ? styles.textSecondary : '#ffffff',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  opacity: 0.9
                }}
              >
                {shuffledFacts[factIndex]?.text}
              </Text>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '20px'
                }}
              >
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={index}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: index === factIndex ? '#ff6600' : 'rgba(255, 255, 255, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </div>
              
              <div
                style={{
                  color: '#2563EB',
                  fontSize: '14px',
                  opacity: 0.8
                }}
              >
                {showDetailedAnalysis ? (
                  <>
                    ⚡ Сервер нагружен<br />
                    <span style={{ fontSize: '12px', color: '#ffaa00' }}>
                      Подождите немного, обрабатываем данные...
                    </span>
                  </>
                ) : (
                  `⏳ Анализируем профиль... ${factIndex + 1}/8`
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно для закрытого аккаунта */}
      {showClosedAccountModal && closedAccountData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: isLightTheme ? '#ffffff' : 'rgba(30, 30, 30, 0.95)',
              borderRadius: '16px',
              padding: '30px',
              maxWidth: '400px',
              width: '100%',
              border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
              boxShadow: isLightTheme ? '0 4px 20px rgba(0, 0, 0, 0.1)' : '0 4px 20px rgba(0, 0, 0, 0.3)',
              animation: 'fadeInUp 0.5s ease-out'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '64px',
                  marginBottom: '16px'
                }}
              >
                🔒
              </div>
              
              <Title
                level="2"
                style={{
                  color: styles.color,
                  marginBottom: '12px',
                  fontSize: '22px',
                  fontWeight: '500'
                }}
              >
                Закрытый профиль
              </Title>
              
              <Text
                style={{
                  color: styles.textSecondary,
                  fontSize: '14px',
                  lineHeight: '1.5',
                  opacity: 0.9,
                  marginBottom: '20px'
                }}
              >
                Профиль закрыт или аккаунт не существует. Это может быть связано с настройками приватности, ограничениями или удалением аккаунта.
              </Text>
            </div>
            
            {/* Информация о пользователе */}
            <div
              style={{
                background: isLightTheme ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 170, 0, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: `1px solid ${isLightTheme ? 'rgba(255, 193, 7, 0.3)' : 'rgba(255, 170, 0, 0.3)'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <img
                  src={closedAccountData.photo}
                  alt="Avatar"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    marginRight: '12px',
                    border: `2px solid ${isLightTheme ? '#ffc107' : styles.warning}`
                  }}
                />
                <div>
                  <Text style={{ color: styles.color, fontSize: '16px', fontWeight: '500' }}>
                    {closedAccountData.first_name} {closedAccountData.last_name}
                  </Text>
                  <Text style={{ color: isLightTheme ? '#ffc107' : styles.warning, fontSize: '14px' }}>
                    ID: {closedAccountData.user_id}
                  </Text>
                </div>
              </div>
            </div>
            
            {/* Объяснение */}
            <div
              style={{
                background: isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`
              }}
            >
              <Title level="4" style={{ color: isLightTheme ? '#ffc107' : styles.warning, marginBottom: '8px', fontWeight: '500' }}>
                ℹ️ Почему профиль закрыт?
              </Title>
              <Text style={{ color: styles.textSecondary, fontSize: '14px', lineHeight: '1.5' }}>
                Пользователь настроил приватность профиля. Это может быть сделано для защиты личной информации или по другим причинам.
              </Text>
            </div>
            
            {/* Кнопка закрытия */}
            <div style={{ textAlign: 'center' }}>
              <Button
                size="l"
                mode="primary"
                onClick={() => {
                  setShowClosedAccountModal(false);
                  setClosedAccountData(null);
                }}
                style={{
                  background: isLightTheme ? 'linear-gradient(135deg, #ffc107 0%, #ffb300 100%)' : styles.warningGradient,
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '16px 32px',
                  color: isLightTheme ? '#000000' : '#000000'
                }}
              >
                Понятно
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно лимита попыток */}
      {showLimitModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '400px',
              width: '100%',
              border: '2px solid #ff0000',
              boxShadow: '0 0 30px rgba(255, 0, 0, 0.5)',
              animation: 'fadeInUp 0.5s ease-out'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '64px',
                  marginBottom: '16px',
                  animation: 'pulse 2s infinite'
                }}
              >
                ⏰
              </div>
              
              <Title
                level="2"
                style={{
                  color: '#ff0000',
                  marginBottom: '12px',
                  fontSize: '22px',
                  fontWeight: 'bold'
                }}
              >
                Лимит попыток исчерпан
              </Title>
              
              <Text
                style={{
                  color: isLightTheme ? styles.textSecondary : '#ffffff',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  opacity: 0.9,
                  marginBottom: '20px'
                }}
              >
                Вы использовали все попытки на сегодня. Лимит обновится автоматически завтра.
              </Text>
            </div>
            
            {/* Информация о лимите */}
            <div
              style={{
                background: 'rgba(255, 0, 0, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid rgba(255, 0, 0, 0.3)'
              }}
            >
              <Title level="4" style={{ color: '#ff0000', marginBottom: '8px' }}>
                📅 Ежедневный лимит
              </Title>
              <Text style={{ color: isLightTheme ? styles.textSecondary : '#ffffff', fontSize: '14px', lineHeight: '1.5' }}>
                • Бесплатных попыток в день: {dailyLimit === Infinity ? '∞' : dailyLimit ?? '—'}<br/>
                • Осталось: {dailyAttempts === Infinity ? '∞' : dailyAttempts ?? '—'}<br/>
                • Лимит обновляется в 00:00 (московское время)
              </Text>
            </div>
            
            {/* Кнопки */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button
                size="m"
                mode="secondary"
                onClick={() => setShowLimitModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#7c827c',
                  borderRadius: '20px'
                }}
              >
                Закрыть
              </Button>
              
              <Button
                size="m"
                mode="primary"
                onClick={showAdForExtraAttempt}
                loading={isAdLoading}
                style={{
                    background: styles.primaryGradient,
                  border: 'none',
                  borderRadius: '20px',
                  color: isLightTheme ? '#ffffff' : '#000000',
                  fontWeight: 'bold'
                }}
              >
                📺 Смотреть рекламу
              </Button>

              <Button
                size="m"
                mode="primary"
                appearance="neutral"
                onClick={() => {
                  setShowLimitModal(false);
                  handleCreateSubscription();
                }}
                style={{
                  background: isLightTheme ? '#ffffff' : 'rgba(255,255,255,0.12)',
                  color: isLightTheme ? styles.primary : '#ffffff',
                  border: `1px solid ${isLightTheme ? styles.primary : 'rgba(255,255,255,0.4)'}`,
                  borderRadius: '20px',
                  fontWeight: 'bold'
                }}
              >
                ❄️ Снежная подписка
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно "Пользователь не найден" */}
      {showUserNotFoundModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '400px',
              width: '100%',
              border: '2px solid #ff6b6b',
              boxShadow: '0 0 30px rgba(255, 107, 107, 0.5)',
              animation: 'fadeInUp 0.5s ease-out'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '64px',
                  marginBottom: '16px',
                  animation: 'pulse 2s infinite'
                }}
              >
                ❌
              </div>
              
              <Title
                level="2"
                style={{
                  color: '#ff6b6b',
                  marginBottom: '12px',
                  fontSize: '22px',
                  fontWeight: 'bold'
                }}
              >
                Пользователь не найден
              </Title>
              
              <Text
                style={{
                  color: isLightTheme ? styles.textSecondary : '#ffffff',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  opacity: 0.9,
                  marginBottom: '20px'
                }}
              >
                Пользователь с таким именем не существует или удален.<br/>
                Проверьте правильность ввода и попробуйте снова.
              </Text>
            </div>
            
            {/* Информация о правильном формате */}
            <div
              style={{
                background: 'rgba(255, 107, 107, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid rgba(255, 107, 107, 0.3)'
              }}
            >
              <Title level="4" style={{ color: '#ff6b6b', marginBottom: '8px' }}>
                📝 Правильные форматы
              </Title>
              <Text style={{ color: isLightTheme ? styles.textSecondary : '#ffffff', fontSize: '14px', lineHeight: '1.5' }}>
                • ID пользователя: 12345<br/>
                • Ссылка: vk.com/username<br/>
                • Короткое имя: username
              </Text>
            </div>
            
            {/* Кнопка закрытия */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                size="m"
                mode="primary"
                onClick={() => setShowUserNotFoundModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%)',
                  border: 'none',
                  borderRadius: '20px',
                  color: '#7c827c',
                  fontWeight: 'bold',
                  padding: '12px 30px'
                }}
              >
                Понятно
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно сообщества */}
      {showCommunityModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '450px',
              width: '100%',
              border: '2px solid #007bff',
              boxShadow: '0 0 30px rgba(0, 123, 255, 0.5)',
              animation: 'fadeInUp 0.5s ease-out'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '64px',
                  marginBottom: '16px',
                  animation: 'pulse 2s infinite'
                }}
              >
                👥
              </div>
              
              <Title
                level="2"
                style={{
                  color: '#007bff',
                  marginBottom: '12px',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}
              >
                Сообщество FakeCheck
              </Title>
              
              <Text
                style={{
                  color: isLightTheme ? styles.textSecondary : '#ffffff',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  opacity: 0.9,
                  marginBottom: '20px'
                }}
              >
                Присоединяйтесь к нашему сообществу и будьте в курсе всех обновлений
              </Text>
            </div>
            
            {/* Преимущества */}
            <div style={{ marginBottom: '20px' }}>
              <Title level="3" style={{ color: '#007bff', marginBottom: '16px', textAlign: 'center' }}>
                🎁 Что вы получите
              </Title>
              
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ color: '#00ff00', fontSize: '20px', marginRight: '12px' }}>✅</div>
                  <Text style={{ color: '#7c827c', fontSize: '16px' }}>
                    Новости о новых возможностях
                  </Text>
                </div>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ color: '#00ff00', fontSize: '20px', marginRight: '12px' }}>✅</div>
                  <Text style={{ color: '#7c827c', fontSize: '16px' }}>
                    Советы по безопасности
                  </Text>
                </div>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ color: '#00ff00', fontSize: '20px', marginRight: '12px' }}>✅</div>
                  <Text style={{ color: '#7c827c', fontSize: '16px' }}>
                    Общение с другими пользователями
                  </Text>
                </div>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ color: '#00ff00', fontSize: '20px', marginRight: '12px' }}>✅</div>
                  <Text style={{ color: '#7c827c', fontSize: '16px' }}>
                    Эксклюзивные материалы
                  </Text>
                </div>
              </div>
            </div>
            
            {/* Информация о сообществе */}
            <div
              style={{
                background: 'rgba(0, 123, 255, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid rgba(0, 123, 255, 0.3)'
              }}
            >
              <Title level="4" style={{ color: '#007bff', marginBottom: '8px' }}>
                🚀 Наше сообщество
              </Title>
              <Text style={{ color: '#7c827c', fontSize: '14px', lineHeight: '1.5' }}>
                • Более 1000 активных пользователей<br/>
                • Ежедневные обновления и новости<br/>
                • Поддержка и помощь от команды<br/>
                • Эксклюзивный контент для подписчиков
              </Text>
            </div>
            
            {/* Кнопки */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                size="m"
                mode="secondary"
                onClick={() => setShowCommunityModal(false)}
                style={{
                  background: 'rgba(0, 51, 255, 0.1)',
                  border: '1px solid rgba(22, 105, 206, 0.3)',
                  color: '#2563EB',
                  borderRadius: '20px'
                }}
              >
                Отмена
              </Button>
              
              <Button
                size="m"
                mode="primary"
                onClick={handleJoinCommunity}
                disabled={isJoiningCommunity || isCommunityJoined}
                style={{
                  background: isCommunityJoined 
                    ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                    : isJoiningCommunity 
                    ? 'rgba(0, 123, 255, 0.5)' 
                    : 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                  border: 'none',
                  borderRadius: '20px',
                  color: '#7c827c',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  padding: '12px 24px',
                  cursor: (isJoiningCommunity || isCommunityJoined) ? 'not-allowed' : 'pointer',
                  opacity: isCommunityJoined ? 0.8 : 1
                }}
              >
                {isCommunityJoined ? '✅ Поддержано' : isJoiningCommunity ? '⏳ Обработка...' : '👥 Поддержать'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно о подписке */}
      {showSubscriptionInfoModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0b1b2b 0%, #1c3a5f 100%)',
              borderRadius: '20px',
              padding: '26px',
              maxWidth: '440px',
              width: '100%',
              border: '1px solid rgba(125, 208, 255, 0.4)',
              boxShadow: '0 0 24px rgba(12, 56, 94, 0.5)',
              animation: 'fadeInUp 0.4s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '42px' }}>❄️</div>
              <Title level="2" style={{ color: '#ffffff', margin: 0, fontWeight: '700' }}>
                Что даёт подписка
              </Title>
            </div>
            <Text style={{ color: '#cbe9ff', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px' }}>
              Снежная подписка открывает безлимитные проверки, убирает лимиты и добавляет зимние бонусы.
            </Text>
            <div style={{ color: '#cbe9ff', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              <div>• ∞ попыток проверки аккаунтов</div>
              <div>• Приоритетная очередь и факты в реальном времени</div>
              <div>• Праздничные снежинки и тёплый статус в профиле</div>
            </div>
            <Text style={{ color: '#9bd5ff', fontSize: '13px', marginBottom: '18px' }}>
              Продолжая, вы подтвердите оформление. При повторном оформлении потребуется оплата голосами.
            </Text>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button
                size="m"
                mode="secondary"
                onClick={() => setShowSubscriptionInfoModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#cbe9ff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '14px'
                }}
              >
                Отмена
              </Button>
              <Button
                size="m"
                mode="primary"
                loading={isCheckingSubscriptionMemory}
                onClick={handleSubscriptionInfoConfirm}
                style={{
                  background: '#7dd0ff',
                  color: '#0b1b2b',
                  border: 'none',
                  borderRadius: '14px',
                  fontWeight: '600'
                }}
              >
                Продолжить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно оплаты голосами для повторного оформления */}
      {showSubscriptionPaymentModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #0f172a 100%)',
              borderRadius: '20px',
              padding: '26px',
              maxWidth: '440px',
              width: '100%',
              border: '2px solid #7dd0ff',
              boxShadow: '0 0 24px rgba(125, 208, 255, 0.4)',
              animation: 'fadeInUp 0.4s ease-out'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>💎</div>
              <Title level="2" style={{ color: '#7dd0ff', margin: 0, fontWeight: '700' }}>
                Повторное оформление
              </Title>
              <Text style={{ color: '#cfd9ff', fontSize: '14px', lineHeight: '1.6', marginTop: '10px' }}>
                Мы запомнили ваше прошлое оформление. Для повторной активации VK спишет 5 голосов.
              </Text>
              <Text style={{ color: '#9ea7c6', fontSize: '12px', marginTop: '8px' }}>
                История: оформлений — {subscriptionMemory.activated || 0}, отмен — {subscriptionMemory.cancelled || 0}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                size="m"
                mode="secondary"
                onClick={() => setShowSubscriptionPaymentModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#cfd9ff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '14px'
                }}
              >
                Отмена
              </Button>
              <Button
                size="m"
                mode="primary"
                onClick={handleSubscriptionPaymentConfirm}
                loading={isSubscriptionLoading}
                style={{
                  background: 'linear-gradient(135deg, #7dd0ff 0%, #4fa8ff 100%)',
                  color: '#0b1b2b',
                  border: 'none',
                  borderRadius: '14px',
                  fontWeight: '700'
                }}
              >
                Оплатить 5 голосов
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно опроса улучшения приложения */}
      {showSurveyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '2px solid #9c27b0',
              boxShadow: '0 0 30px rgba(156, 39, 176, 0.5)',
              animation: 'fadeInUp 0.5s ease-out'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '48px',
                  marginBottom: '16px',
                  animation: 'pulse 2s infinite'
                }}
              >
                💡
              </div>
              
              <Title
                level="2"
                style={{
                  color: isLightTheme ? '#7b2cbf' : '#b794f6',
                  marginBottom: '12px',
                  fontSize: '22px',
                  fontWeight: '500'
                }}
              >
                Улучши приложение
              </Title>
              
              <Text
                style={{
                  color: styles.textSecondary,
                  fontSize: '14px',
                  lineHeight: '1.5',
                  opacity: 0.9,
                  marginBottom: '20px'
                }}
              >
                Ваше мнение поможет нам сделать FakeCheck еще лучше!
              </Text>
            </div>
            
            {/* Вопрос 1: Точность анализа */}
            <div style={{ marginBottom: '20px' }}>
              <Title level="3" style={{ color: isLightTheme ? '#7b2cbf' : '#b794f6', marginBottom: '12px', fontWeight: '500' }}>
                1️⃣ Как вы оцениваете точность анализа?
              </Title>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: 'very_accurate', label: 'Очень точный', color: '#00ff00' },
                  { value: 'accurate', label: 'Точный', color: '#00cc00' },
                  { value: 'average', label: 'Средний', color: '#ffaa00' },
                  { value: 'inaccurate', label: 'Неточный', color: '#ff6600' },
                  { value: 'very_inaccurate', label: 'Очень неточный', color: '#ff0000' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    size="m"
                    mode={surveyData.accuracy === option.value ? "primary" : "secondary"}
                    onClick={() => updateSurveyData('accuracy', option.value)}
                    style={{
                      background: surveyData.accuracy === option.value 
                        ? (isLightTheme ? `linear-gradient(135deg, ${option.color} 0%, ${option.color}dd 100%)` : `linear-gradient(135deg, ${option.color} 0%, ${option.color}dd 100%)`)
                        : (isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)'),
                      border: surveyData.accuracy === option.value 
                        ? `2px solid ${option.color}` 
                        : `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                      color: surveyData.accuracy === option.value ? (isLightTheme ? '#000000' : '#000000') : styles.textSecondary,
                      borderRadius: '20px',
                      fontWeight: '500',
                      textAlign: 'left',
                      justifyContent: 'flex-start'
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Вопрос 2: Желаемые функции */}
            <div style={{ marginBottom: '20px' }}>
              <Title level="3" style={{ color: isLightTheme ? '#7b2cbf' : '#b794f6', marginBottom: '12px', fontWeight: '500' }}>
                2️⃣ Какие функции вы хотели бы видеть?
              </Title>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: 'batch_check', label: 'Массовая проверка друзей' },
                  { value: 'history_export', label: 'Экспорт истории проверок' },
                  { value: 'notifications', label: 'Уведомления о новых фейках' },
                  { value: 'advanced_stats', label: 'Расширенная статистика' },
                  { value: 'api_access', label: 'API для разработчиков' }
                ].map((feature) => (
                  <Button
                    key={feature.value}
                    size="m"
                    mode={surveyData.features.includes(feature.value) ? "primary" : "secondary"}
                    onClick={() => toggleFeature(feature.value)}
                    style={{
                      background: surveyData.features.includes(feature.value) 
                        ? (isLightTheme ? 'linear-gradient(135deg, #7b2cbf 0%, #5a189a 100%)' : 'linear-gradient(135deg, #b794f6 0%, #9f7aea 100%)')
                        : (isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)'),
                      border: surveyData.features.includes(feature.value) 
                        ? (isLightTheme ? '2px solid #7b2cbf' : '2px solid #b794f6')
                        : `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                      color: surveyData.features.includes(feature.value) ? (isLightTheme ? '#ffffff' : '#000000') : styles.textSecondary,
                      borderRadius: '20px',
                      fontWeight: '500',
                      textAlign: 'left',
                      justifyContent: 'flex-start'
                    }}
                  >
                    {surveyData.features.includes(feature.value) ? '✅ ' : '⬜ '}{feature.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Вопрос 3: Предложения */}
            <div style={{ marginBottom: '20px' }}>
              <Title level="3" style={{ color: isLightTheme ? '#7b2cbf' : '#b794f6', marginBottom: '12px', fontWeight: '500' }}>
                3️⃣ Ваши предложения по улучшению
              </Title>
              
              <Input
                placeholder="Расскажите, что можно улучшить..."
                value={surveyData.suggestions}
                onChange={(e) => updateSurveyData('suggestions', e.target.value)}
                style={{
                  background: isLightTheme ? 'rgba(255, 255, 255, 0.03)' : 'rgba(245, 245, 245, 0.05)',
                  border: `1px solid ${isLightTheme ? 'rgba(248, 246, 246, 0.1)' : 'rgba(247, 246, 249, 0.15)'}`,
                  borderRadius: '10px',
                  color: styles.color,
                  padding: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* Информация о канале */}
            <div style={{ marginBottom: '20px' }}>
              <Title level="3" style={{ color: isLightTheme ? '#7b2cbf' : '#b794f6', marginBottom: '12px', fontWeight: '500' }}>
                4️⃣ Полезная информация
              </Title>
              
              <div
                style={{
                  background: isLightTheme ? 'rgba(123, 44, 191, 0.1)' : 'rgba(183, 148, 246, 0.1)',
                  borderRadius: '10px',
                  padding: '16px',
                  border: `1px solid ${isLightTheme ? 'rgba(123, 44, 191, 0.3)' : 'rgba(183, 148, 246, 0.3)'}`,
                  textAlign: 'center'
                }}
              >
                <Text style={{ color: styles.textSecondary, fontSize: '16px', lineHeight: '1.5', marginBottom: '12px' }}>
                  📢 Рассказываем о схемах мошенников в нашем канале
                </Text>
                
                <Button
                  size="m"
                  mode="primary"
                  onClick={() => window.open('https://vk.com/fakecheeck', '_blank')}
                  style={{
                    background: isLightTheme ? styles.primaryGradient : styles.primaryGradient,
                    border: 'none',
                    borderRadius: '20px',
                    color: isLightTheme ? '#ffffff' : '#000000',
                    fontWeight: '500',
                    padding: '12px 24px',
                    fontSize: '14px'
                  }}
                >
                  👥 Перейти в канал @fakecheeck
                </Button>
              </div>
            </div>
            
            {/* Кнопки */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                size="m"
                mode="secondary"
                onClick={() => setShowSurveyModal(false)}
                style={{
                  background: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  border: `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
                  color: styles.color,
                  borderRadius: '20px'
                }}
              >
                Отмена
              </Button>
              
              <Button
                size="m"
                mode="primary"
                onClick={handleSubmitSurvey}
                disabled={isSubmittingSurvey || !surveyData.accuracy}
                style={{
                  background: isSubmittingSurvey || !surveyData.accuracy
                    ? (isLightTheme ? 'rgba(123, 44, 191, 0.3)' : 'rgba(183, 148, 246, 0.3)')
                    : (isLightTheme ? 'linear-gradient(135deg, #7b2cbf 0%, #5a189a 100%)' : 'linear-gradient(135deg, #b794f6 0%, #9f7aea 100%)'),
                  border: 'none',
                  borderRadius: '20px',
                  color: isLightTheme ? '#ffffff' : '#000000',
                  fontWeight: '500',
                  cursor: isSubmittingSurvey || !surveyData.accuracy ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmittingSurvey ? '⏳ Отправляем...' : '💡 Отправить отзыв'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Дополнительные блоки внизу страницы */}
      <Group 
        header={
          <Header 
            size="s" 
            style={{ color: styles.color, fontSize: '14px', fontWeight: '500' }}
          >
            Дополнительные функции
          </Header>
        }
      >
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          margin: '8px' 
        }}>
          {/* Снежная подписка */}
          <div
            className="animate-fade-in-up hover-lift"
            style={{
              animationDelay: '0.05s',
              background: 'linear-gradient(135deg, #0b1b2b 0%, #1c3a5f 100%)',
              borderRadius: '16px',
              margin: '0',
              border: '1px solid rgba(125, 208, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: '130px',
              padding: '16px',
              textAlign: 'left',
              cursor: 'pointer',
              boxShadow: '0 12px 28px rgba(12, 56, 94, 0.4)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div style={{ flex: 1, zIndex: 2 }}>
              <Title level="3" style={{ color: '#ffffff', marginBottom: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span role="img" aria-label="snow">{subscriptionIcon}</span> Снежная подписка
              </Title>
              <Text style={{ color: '#f1e9ff', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px', maxWidth: '260px' }}>
                {subscriptionStatusText}
              </Text>
              <Button
                size="s"
                mode="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubscriptionButtonClick();
                }}
                style={{
                  background: '#7dd0ff',
                  color: '#0b1b2b',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '600',
                  padding: '10px 18px'
                }}
                loading={isSubscriptionLoading || isCheckingSubscriptionMemory}
              >
                {subscriptionActive ? 'Отменить' : 'Оформить'}
              </Button>
              {subscriptionError && (
                <Text style={{ color: '#ffbac4', fontSize: '12px', marginTop: '6px' }}>
                  {subscriptionError}
                </Text>
              )}
              {subscriptionMessage && (
                <Text style={{ color: '#c7f9ff', fontSize: '12px', marginTop: '6px' }}>
                  {subscriptionMessage}
                </Text>
              )}
            </div>
            <div
              aria-hidden
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #d6f3ff 0%, #9ed7ff 40%, #6ab5f6 70%, #3e8ccf 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 30px rgba(14, 80, 130, 0.35)'
              }}
            >
              <span style={{ fontSize: '54px' }}>{subscriptionIcon}</span>
            </div>
          </div>

          {/* Блок поделиться */}
          <div
            className="animate-fade-in-up hover-lift"
            style={{
              animationDelay: '0.1s',
              background: isLightTheme ? 'rgba(0, 123, 255, 0.12)' : 'rgba(100, 149, 237, 0.15)',
              borderRadius: '12px',
              margin: '0',
              border: `2px solid ${isLightTheme ? 'rgba(0, 123, 255, 0.3)' : 'rgba(100, 149, 237, 0.4)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60px',
              padding: '8px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={handleInviteFriend}
          >
            <span style={{
              color: isLightTheme ? '#0056b3' : '#6495ed',
              fontSize: '14px',
              fontWeight: '600',
              textAlign: 'center',
              lineHeight: '1.2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              📤 Поделиться
            </span>
          </div>

          {/* Блок улучшения */}
          <div
            className="animate-fade-in-up hover-lift"
            style={{
              animationDelay: '0.2s',
              background: isLightTheme ? 'rgba(123, 44, 191, 0.12)' : 'rgba(183, 148, 246, 0.15)',
              borderRadius: '12px',
              margin: '0',
              border: `2px solid ${isLightTheme ? 'rgba(123, 44, 191, 0.3)' : 'rgba(183, 148, 246, 0.4)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60px',
              padding: '8px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setShowSurveyModal(true)}
          >
            <span style={{
              color: isLightTheme ? '#7b2cbf' : '#b794f6',
              fontSize: '14px',
              fontWeight: '600',
              textAlign: 'center',
              lineHeight: '1.2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              💡 Улучшить
            </span>
          </div>

          {/* Блок избранного */}
          {!isInFavorites && (
            <div
              className="animate-fade-in-up hover-lift"
              style={{
                animationDelay: '0.3s',
                background: isLightTheme ? 'rgba(255, 193, 7, 0.12)' : 'rgba(255, 215, 0, 0.15)',
                borderRadius: '12px',
                margin: '0',
                border: `2px solid ${isLightTheme ? 'rgba(255, 193, 7, 0.3)' : 'rgba(255, 215, 0, 0.4)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '60px',
                padding: '8px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={handleAddToFavorites}
            >
              <span style={{ 
                color: isLightTheme ? '#d4af37' : '#ffd700', 
                fontSize: '14px', 
                fontWeight: '600', 
                textAlign: 'center',
                lineHeight: '1.2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%'
              }}>
                ⭐ В избранное
              </span>
            </div>
          )}

          {/* Блок статуса избранного */}
          {isInFavorites && (
            <div
              className="animate-fade-in-up hover-lift"
              style={{
                animationDelay: '0.3s',
                background: isLightTheme ? 'rgba(40, 167, 69, 0.12)' : 'rgba(0, 255, 0, 0.15)',
                borderRadius: '12px',
                margin: '0',
                border: `2px solid ${isLightTheme ? 'rgba(40, 167, 69, 0.3)' : 'rgba(0, 255, 0, 0.4)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '60px',
                padding: '8px',
                textAlign: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ 
                color: isLightTheme ? '#28a745' : '#00ff00', 
                fontSize: '14px', 
                fontWeight: '600', 
                textAlign: 'center',
                lineHeight: '1.2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%'
              }}>
                ✅ Избранное
              </span>
            </div>
          )}
        </div>
      </Group>
    </Panel>
  );
};

Home.propTypes = {
  id: PropTypes.string.isRequired,
  fetchedUser: PropTypes.shape({
    photo_200: PropTypes.string,
    first_name: PropTypes.string,
    last_name: PropTypes.string,
    city: PropTypes.shape({
      title: PropTypes.string,
    }),
  }),
};
