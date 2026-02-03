export const environment = {
  production: true,
  apiUrl: 'https://ba-back.marcostorresalarcon.com',
  /** Ruta del endpoint para eliminar cuenta. Si el backend usa prefijo global (ej. /api), usar 'api/auth/account'. */
  authDeleteAccountPath: 'auth/account',
  s3BucketName: 'ba-bucket-aws',
  s3AccessKeyId: 'AKIAWYSDDOVTLZNIRXTH',
  s3SecretAccessKey: 'Fw55Ll+6FRF0696adBUUW8Je6e5UgOBBWftAWNQV',
  s3Region: 'us-east-1',
  stripePublicKey: 'pk_test_placeholder',
  apiKeyMaps: 'AIzaSyDMv_UAG_BzDBe6Fv5Iljhi3akq3wjAAdU'
} as const;


