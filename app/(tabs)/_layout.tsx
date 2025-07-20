import { Tabs, useRouter } from 'expo-router';
import React from 'react';

import FloatingBottomBar from '@/components/FloatingBottomBar';
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useTabContext } from '@/contexts/TabContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { setActiveTab } = useTabContext();

  const tabs = [
    {
      key: 'index',
      title: 'Feed',
      icon: 'house.fill',
      onPress: () => {
        setActiveTab('index');
        router.push('/(tabs)');
      },
    },
    {
      key: 'discover',
      title: 'Discover',
      icon: 'sparkles',
      onPress: () => {
        setActiveTab('discover');
        router.push('/(tabs)/discover');
      },
    },
    {
      key: 'post',
      title: 'Post',
      icon: 'plus.circle.fill',
      onPress: () => {
        setActiveTab('post');
        router.push('/(tabs)/post');
      },
    },
    {
      key: 'saved',
      title: 'Saved',
      icon: 'heart.fill',
      onPress: () => {
        setActiveTab('saved');
        router.push('/(tabs)/saved');
      },
    },
    {
      key: 'profile',
      title: 'Profile',
      icon: 'person.fill',
      onPress: () => {
        setActiveTab('profile');
        router.push('/(tabs)/profile');
      },
    },
  ];

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: {
            display: 'none', // Hide the default tab bar
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
          }}
        />
        <Tabs.Screen
          name="post"
          options={{
            title: 'Post',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="plus.circle.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="saved"
          options={{
            title: 'Saved',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          }}
        />
        
      </Tabs>
      <FloatingBottomBar tabs={tabs} />
    </>
  );
}
