export const appEnvironment =
  process.env.EXPO_PUBLIC_APP_ENV || 'production';

export const isProduction = appEnvironment === 'production';
export const isStaging = !isProduction;
