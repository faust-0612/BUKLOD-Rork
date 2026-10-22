import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

export type GCashDetails = {
  number: string;
  accountName: string;
  paymentUrl: string;
};

function clean(
  value: string | undefined
) {
  return (
    value
    ?? ''
  ).trim();
}

export function getGCashDetails():
  GCashDetails {

  return {
    number:
      clean(
        process.env
          .EXPO_PUBLIC_GCASH_NUMBER
      ),

    accountName:
      clean(
        process.env
          .EXPO_PUBLIC_GCASH_ACCOUNT_NAME
      ),

    paymentUrl:
      clean(
        process.env
          .EXPO_PUBLIC_GCASH_PAYMENT_URL
      ),
  };
}

export function hasGCashDetails() {
  const details =
    getGCashDetails();

  return (
    details.number.length > 0 &&
    details.accountName.length > 0
  );
}

export async function copyGCashNumber() {
  const {
    number,
  } =
    getGCashDetails();

  if (!number) {
    throw new Error(
      'GCash number is not configured.'
    );
  }

  await Clipboard
    .setStringAsync(
      number
    );

  return true;
}

export async function copyGCashAccountName() {
  const {
    accountName,
  } =
    getGCashDetails();

  if (!accountName) {
    throw new Error(
      'GCash account name is not configured.'
    );
  }

  await Clipboard
    .setStringAsync(
      accountName
    );

  return true;
}

export async function openGCashPayment() {
  const {
    paymentUrl,
  } =
    getGCashDetails();

  if (!paymentUrl) {
    throw new Error(
      'GCash payment URL is not configured.'
    );
  }

  let parsed: URL;

  try {
    parsed =
      new URL(
        paymentUrl
      );
  }
  catch {
    throw new Error(
      'GCash payment URL is invalid.'
    );
  }

  if (
    parsed.protocol !==
    'https:'
  ) {
    throw new Error(
      'GCash payment URL must use HTTPS.'
    );
  }

  const canOpen =
    await Linking
      .canOpenURL(
        paymentUrl
      )
      .catch(
        () => false
      );

  if (!canOpen) {
    throw new Error(
      'GCash payment URL cannot be opened on this device.'
    );
  }

  return WebBrowser
    .openBrowserAsync(
      paymentUrl
    );
}