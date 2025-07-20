import { useSignUp } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import * as React from 'react'
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [pendingVerification, setPendingVerification] = React.useState(false)
  const [code, setCode] = React.useState('')

  // Handle submission of sign-up form
  const onSignUpPress = async () => {
    if (!isLoaded) return

    // Start sign-up process using email and password provided
    try {
      await signUp.create({
        emailAddress,
        password,
      })

      // Send user an email with verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

      // Set 'pendingVerification' to true to display second form
      // and capture OTP code
      setPendingVerification(true)
    } catch (err: any) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2))
      Alert.alert('Error', err?.errors?.[0]?.message || 'Sign up failed')
    }
  }

  // Handle submission of verification form
  const onVerifyPress = async () => {
    if (!isLoaded) return

    try {
      // Use the code the user provided to attempt verification
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      })

      // If verification was completed, set the session to active
      // and redirect the user
      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId })
        router.replace('/(tabs)')
      } else {
        // If the status is not complete, check why. User may need to
        // complete further steps.
        console.error(JSON.stringify(signUpAttempt, null, 2))
        Alert.alert('Error', 'Verification failed. Please try again.')
      }
    } catch (err: any) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2))
      Alert.alert('Error', err?.errors?.[0]?.message || 'Verification failed')
    }
  }

  if (pendingVerification) {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to{'\n'}{emailAddress}
          </Text>
        </View>
        
        <TextInput
          style={styles.codeInput}
          value={code}
          placeholder="000000"
          placeholderTextColor="#666"
          onChangeText={(code) => setCode(code)}
          keyboardType="number-pad"
          textAlign="center"
          maxLength={6}
        />
        
        <TouchableOpacity 
          style={styles.verifyButton}
          onPress={onVerifyPress}
        >
          <Text style={styles.verifyButtonText}>Verify Email</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.brandName}>OnlyFashion</Text>
        <Text style={styles.title}>Join OnlyFashion</Text>
        <Text style={styles.subtitle}>Create your account</Text>
      </View>
      
      <View style={styles.formSection}>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          value={emailAddress}
          placeholder="Enter email"
          placeholderTextColor="#666"
          onChangeText={(email) => setEmailAddress(email)}
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          value={password}
          placeholder="Create password"
          placeholderTextColor="#666"
          secureTextEntry={true}
          onChangeText={(password) => setPassword(password)}
        />
      </View>
      
      <TouchableOpacity 
        style={styles.signUpButton}
        onPress={onSignUpPress}
      >
        <Text style={styles.signUpButtonText}>Create Account</Text>
      </TouchableOpacity>
      
      <View style={styles.linkContainer}>
        <Text style={styles.linkText}>Already have an account? </Text>
        <Link href="/(auth)/sign-in">
          <Text style={styles.link}>Sign in</Text>
        </Link>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#000',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  brandName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#7c3aed',
    marginBottom: 8,
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  formSection: {
    gap: 16,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#7c3aed',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#fff',
    backgroundColor: '#111827',
    fontSize: 16,
  },
  codeInput: {
    height: 64,
    borderWidth: 2,
    borderColor: '#7c3aed',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#fff',
    backgroundColor: '#111827',
    fontSize: 24,
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 8,
    marginBottom: 32,
  },
  signUpButton: {
    backgroundColor: '#7c3aed',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#7c3aed',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  linkText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  link: {
    fontSize: 16,
    color: '#7c3aed',
    fontWeight: '600',
  },
});