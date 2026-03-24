export const environment = {
    production: false,
    apiUrl: 'https://ba-back.marcostorresalarcon.com',
    // apiUrl: 'http://localhost:3022',
    /** Apple Developer Team ID (referencia; firma real en ios/ project.pbxproj y exportOptions*.plist). */
    appleTeamId: '5G8B5KR88X',
    /** Ruta del endpoint para eliminar cuenta. Si el backend usa prefijo global (ej. /api), usar 'api/auth/account'. */
    authDeleteAccountPath: 'auth/account',
    s3BucketName: 'ba-bucket-aws',
    s3AccessKeyId: 'AKIAWYSDDOVTLZNIRXTH',
    s3SecretAccessKey: 'Fw55Ll+6FRF0696adBUUW8Je6e5UgOBBWftAWNQV',
    s3Region: 'us-east-1',
    stripePublicKey: 'pk_test_placeholder', // Replace with actual Stripe Publishable Key-    
    apiKeyMaps: 'AIzaSyDMv_UAG_BzDBe6Fv5Iljhi3akq3wjAAdU'
} as const;
