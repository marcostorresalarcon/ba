import Foundation
import Capacitor
import PhotosUI
import UniformTypeIdentifiers

@objc(NativeVideoPicker)
public class NativeVideoPicker: CAPPlugin, PHPickerViewControllerDelegate {

    @objc func pickVideo(_ call: CAPPluginCall) {
        let allowMultiple = call.getBool("allowMultiple", false)
        
        DispatchQueue.main.async {
            var configuration = PHPickerConfiguration()
            configuration.filter = .videos // FILTRO CLAVE: Solo videos
            configuration.selectionLimit = allowMultiple ? 0 : 1
            
            let picker = PHPickerViewController(configuration: configuration)
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true, completion: nil)
            self.bridge?.saveCall(call)
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true, completion: nil)
        
        guard let call = self.bridge?.getSavedCall() else { return }
        
        if results.isEmpty {
            call.resolve(["files": []])
            return
        }
        
        var selectedFiles: [[String: Any]] = []
        let group = DispatchGroup()
        
        for result in results {
            group.enter()
            let provider = result.itemProvider
            
            // Verificar si es un video
            if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, error in
                    defer { group.leave() }
                    
                    if let url = url {
                        // El sistema da una URL temporal que se borra al terminar el bloque.
                        // La copiamos a una ubicación temporal de la app para procesarla.
                        let fileName = url.lastPathComponent
                        let tempDir = FileManager.default.temporaryDirectory
                        let targetUrl = tempDir.appendingPathComponent(UUID().uuidString + "_" + fileName)
                        
                        do {
                            try FileManager.default.copyItem(at: url, to: targetUrl)
                            selectedFiles.append([
                                "path": targetUrl.absoluteString,
                                "name": fileName,
                                "mimeType": "video/quicktime" // Fallback común en iOS
                            ])
                        } catch {
                            print("[NativeVideoPicker] Error al copiar video: \(error)")
                        }
                    }
                }
            } else {
                group.leave()
            }
        }
        
        group.notify(queue: .main) {
            call.resolve(["files": selectedFiles])
        }
    }
}

