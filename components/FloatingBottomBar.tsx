import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTabContext } from '@/contexts/TabContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import {
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabItem {
  key: string;
  title: string;
  icon: any; // Updated to any for IconSymbol compatibility
  onPress: () => void;
}

interface FloatingBottomBarProps {
  tabs: TabItem[];
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function FloatingBottomBar({ tabs }: FloatingBottomBarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { activeTab } = useTabContext();
  
  const containerScale = useSharedValue(0);

  // Mount animation
  useEffect(() => {
    containerScale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
      mass: 0.8,
    });
  }, [containerScale]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
  }));

  const renderTab = (tab: TabItem, index: number) => {
    const isActive = tab.key === activeTab;
    
    const handlePress = () => {
      // Add haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      tab.onPress();
    };
    
    return (
      <AnimatedTouchableOpacity
        layout={LinearTransition.springify().damping(15).stiffness(200).mass(0.5)}
        key={tab.key}
        style={[
          styles.tab,
          {
            backgroundColor: isActive 
              ? colorScheme === 'dark' 
                ? 'rgba(147, 51, 234, 0.25)' // Purple tint for dark mode
                : 'rgba(147, 51, 234, 0.15)' // Purple tint for light mode
              : 'transparent'
          }
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <IconSymbol
          size={22}
          name={tab.icon}
          color={isActive 
            ? colorScheme === 'dark' 
              ? '#a855f7' // Bright purple for dark mode
              : '#7c3aed' // Rich purple for light mode
            : colorScheme === 'dark'
              ? Platform.OS === 'ios'
                ? '#ffffff' // Pure white for iOS dark
                : 'rgba(255, 255, 255, 0.6)' // Original for other platforms
              : Platform.OS === 'ios'
                ? '#374151' // Darker gray for iOS light mode
                : 'rgba(100, 100, 100, 0.8)' // Original for other platforms
          }
        />
        {isActive && (
          <Animated.Text
            entering={FadeIn.duration(200).springify()}
            exiting={FadeOut.duration(150)}
            style={[
              styles.label,
              {
                color: colorScheme === 'dark' ? '#a855f7' : '#7c3aed',
              }
            ]}
          >
            {tab.title}
          </Animated.Text>
        )}
      </AnimatedTouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.container, { bottom: insets.bottom + 25 }, containerAnimatedStyle]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 70 : 85}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        style={styles.blurContainer}
      >
        <View style={[styles.tabContainer, { 
          backgroundColor: colorScheme === 'dark' 
            ? Platform.OS === 'ios' 
              ? 'rgba(0, 0, 0, 0.95)' // Nearly opaque black for iOS dark
              : 'rgba(15, 15, 25, 0.85)' // Original for other platforms
            : Platform.OS === 'ios'
              ? 'rgba(255, 255, 255, 0.75)' // Less opaque white for iOS light to show border
              : 'rgba(255, 255, 255, 0.25)', // Original for other platforms
          borderColor: colorScheme === 'dark'
            ? 'rgba(147, 51, 234, 0.3)' // Purple border in dark mode
            : Platform.OS === 'ios'
              ? 'rgba(147, 51, 234, 0.3)' // Same purple border for iOS light mode
              : 'rgba(255, 255, 255, 0.4)', // Brighter white border for other platforms
        }]}>
          {tabs.map((tab, index) => renderTab(tab, index))}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    alignItems: 'center',
    zIndex: 1000,
  },
  blurContainer: {
    borderRadius: 35,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderRadius: 35,
  },
  tab: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
