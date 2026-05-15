/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>إعادة تعيين كلمة المرور في {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>إعادة تعيين كلمة المرور</Heading>
        <Text style={text}>
          استلمنا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في {siteName}.
          اضغط على الزر أدناه لاختيار كلمة مرور جديدة.
        </Text>
        <Button style={button} href={confirmationUrl}>
          إعادة تعيين كلمة المرور
        </Button>
        <Text style={footer}>
          إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة ولن تتغير كلمة المرور.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
const button = {
  backgroundColor: '#1c7ef7',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#8a93a6', margin: '30px 0 0', lineHeight: '1.6' }
