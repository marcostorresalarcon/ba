#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registrar el plugin NativeVideoPicker para que Capacitor lo reconozca
CAP_PLUGIN(NativeVideoPicker, "NativeVideoPicker",
           CAP_PLUGIN_METHOD(pickVideo, CAPMethodReturnPromise);
)

