import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jijbot.android',
  appName: 'JIJ Bot',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    useLegacyBridge: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#7c3aed',
      sound: 'beep.wav',
    },
  },
}

export default config
