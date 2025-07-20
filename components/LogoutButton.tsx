import { useAuth } from '@clerk/clerk-expo';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

interface LogoutButtonProps {
  variant?: 'default' | 'minimal';
}

export function LogoutButton({ variant = 'default' }: LogoutButtonProps) {
  const { signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of OnlyFashion?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ],
    );
  };

  if (variant === 'minimal') {
    return (
      <TouchableOpacity 
        style={styles.minimalButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <IconSymbol name="arrow.right.square" size={20} color="#7c3aed" />
        <Text style={styles.minimalText}>Sign Out</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.logoutButton}
      onPress={handleLogout}
      activeOpacity={0.7}
    >
      <IconSymbol name="arrow.right.square" size={18} color="#fff" />
      <Text style={styles.logoutText}>Sign Out</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 20,
    gap: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  minimalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  minimalText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '600',
  },
});
