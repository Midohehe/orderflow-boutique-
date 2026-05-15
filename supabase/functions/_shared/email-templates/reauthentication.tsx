/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رمز التحقق الخاص بك</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>تأكيد الهوية</Heading>
        <Text style={text}>استخدم الرمز التالي لتأكيد هويتك:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          ينتهي هذا الرمز قريباً. إذا لم تطلبه يمكنك تجاهل الرسالة بأمان.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Tajawal", Arial, sans-serif', direction: 'rtl' as const, textAlign: 'right' as const }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0b1a3d',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#3d4a66',
  lineHeight: '1.7',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  letterSpacing: '4px',
  fontWeight: 'bold' as const,
  color: '#1c7ef7',
  margin: '0 0 30px',
  textAlign: 'center' as const,
  backgroundColor: '#f1f6ff',
  padding: '16px',
  borderRadius: '12px',
}
const footer = { fontSize: '12px', color: '#8a93a6', margin: '30px 0 0', lineHeight: '1.6' }
