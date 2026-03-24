import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Quote, QuoteCustomer, Materials } from '../../models/quote.model';
import type { KitchenInput } from '../kitchen-inputs/kitchen-inputs.service';
import type { Invoice } from '../../models/invoice.model';
import type { Customer } from '../../models/customer.model';
import type { Project } from '../../models/project.model';
import type { Company } from '../../models/company.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  async generateInvoicePdf(
    invoice: Invoice, 
    customer: Customer | null, 
    project: Project | null, 
    company: Company | null,
    quote?: Quote,
    groupedInputs?: {
      id: string;
      title: string;
      subcategories: {
        id: string;
        title: string;
        inputs: KitchenInput[];
      }[];
    }[]
  ): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15; // Matches standard printer margins
    const contentWidth = pageWidth - margin * 2;
    let yPosition = margin;

    // --- Configuration & Constants ---
    const colors = {
      text: { r: 0, g: 0, b: 0 }, // Black
      secondaryText: { r: 100, g: 100, b: 100 }, // Gray
      headerBg: { r: 51, g: 51, b: 51 }, // Dark Gray #333
      headerText: { r: 255, g: 255, b: 255 }, // White
      border: { r: 230, g: 230, b: 230 }, // Light Gray
      highlight: { r: 245, g: 245, b: 245 } // Very Light Gray
    };

    const companyDetails = {
      name: company?.name || 'BA Kitchen and Bath Design',
      address: ['1739 Canton Rd.', 'Marietta, GA 30066'], // Fallback to image data if missing
      phone: '(770) 627-4661',
      email: 'office@bakitchenandbathdesign.com'
    };

    // --- Header Section ---
    
    // Left Side: Company Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    
    // Handle multi-line company name if needed
    const companyNameLines = doc.splitTextToSize(companyDetails.name, contentWidth / 2);
    doc.text(companyNameLines, margin, yPosition + 5);
    
    let leftY = yPosition + 5 + (companyNameLines.length * 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    companyDetails.address.forEach(line => {
      doc.text(line, margin, leftY);
      leftY += 5;
    });
    
    leftY += 2;
    doc.text(companyDetails.phone, margin, leftY);
    leftY += 5;
    doc.text(companyDetails.email, margin, leftY);

    // Right Side: Invoice Meta
    let rightY = yPosition + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    const invoiceTitle = 'Invoice';
    const invoiceTitleWidth = doc.getTextWidth(invoiceTitle);
    doc.text(invoiceTitle, pageWidth - margin - invoiceTitleWidth, rightY);
    
    rightY += 12;
    
    // Helper for right-aligned pairs
    const drawMetaPair = (label: string, value: string, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      const labelWidth = doc.getTextWidth(label);
      
      doc.text(label, pageWidth - margin - 40 - labelWidth, y); // Label somewhat to the left
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b); // Ensure black
      const valueWidth = doc.getTextWidth(value);
      // Value right aligned to margin
      doc.text(value, pageWidth - margin - valueWidth, y);
    };

    drawMetaPair('Invoice Number:', invoice.number || 'Draft', rightY);
    rightY += 6;
    drawMetaPair('Invoice Date:', this.formatDate(invoice.issueDate), rightY);
    rightY += 6;
    drawMetaPair('Payment Due:', invoice.dueDate ? this.formatDate(invoice.dueDate) : '{set when sent}', rightY);

    yPosition = Math.max(leftY, rightY) + 15;

    // --- Client & Project Section ---
    const drawSectionHeader = (text: string, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      const w = doc.getTextWidth(text);
      doc.text(text, pageWidth - margin - w, y);
    };

    const drawRightAlignedBlock = (lines: string[], startY: number): number => {
      let cy = startY;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      
      lines.forEach(line => {
        if (!line) return;
        const w = doc.getTextWidth(line);
        doc.text(line, pageWidth - margin - w, cy);
        cy += 5;
      });
      return cy;
    };

    // Client Block
    drawSectionHeader('Client', yPosition);
    yPosition += 6;
    
    if (customer) {
      yPosition = drawRightAlignedBlock([
        customer.name + (customer.lastName ? ` ${customer.lastName}` : ''),
        customer.address || '',
        [customer.city, customer.state, customer.zipCode].filter(Boolean).join(', '),
        customer.phone || '',
        customer.email || ''
      ], yPosition);
    }
    
    yPosition += 8;

    // Billing Address Block (Assume same as client for now if not distinct)
    drawSectionHeader('Billing Address', yPosition);
    yPosition += 6;
    
    // "Project" Block
    drawSectionHeader('Project', yPosition);
    yPosition += 6;
    
    if (project) {
      yPosition = drawRightAlignedBlock([
        `${invoice.projectId ? 'P-' + (typeof invoice.projectId === 'string' ? invoice.projectId.slice(-4).toUpperCase() : String((invoice.projectId as any)._id || invoice.projectId).slice(-4).toUpperCase()) : 'Project'} - ${customer?.name || 'Client'}`, 
        customer?.address || '',
        [customer?.city, customer?.state, customer?.zipCode].filter(Boolean).join(', ')
      ], yPosition);
    }

    yPosition += 15;

    // --- Items Table ---
    const tableHeaderHeight = 10;
    const priceColWidth = 40;
    const descColWidth = contentWidth - priceColWidth;
    
    // Header Row
    doc.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b);
    doc.rect(margin, yPosition, contentWidth, tableHeaderHeight, 'F');
    
    doc.setTextColor(colors.headerText.r, colors.headerText.g, colors.headerText.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    
    const headerTextY = yPosition + (tableHeaderHeight / 2) + 1.5; 
    doc.text('DESCRIPTION', margin + 4, headerTextY);
    
    const priceLabel = 'PRICE';
    const priceLabelWidth = doc.getTextWidth(priceLabel);
    doc.text(priceLabel, pageWidth - margin - 4 - priceLabelWidth, headerTextY); 

    yPosition += tableHeaderHeight;

    // Items
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    
    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item, index) => {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
          doc.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b);
          doc.rect(margin, yPosition, contentWidth, tableHeaderHeight, 'F');
          doc.setTextColor(colors.headerText.r, colors.headerText.g, colors.headerText.b);
          doc.text('DESCRIPTION', margin + 4, yPosition + 6.5);
          doc.text(priceLabel, pageWidth - margin - 4 - priceLabelWidth, yPosition + 6.5);
          yPosition += tableHeaderHeight;
          doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
        }

        const isHeader = item.description.toLowerCase().startsWith('change order');
        
        let rowHeight = 10;
        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
        doc.setFontSize(10);
        
        const descLines = doc.splitTextToSize(item.description, descColWidth - 8);
        rowHeight = Math.max(rowHeight, (descLines.length * 5) + 6);

        if (isHeader) {
          doc.setFillColor(colors.highlight.r, colors.highlight.g, colors.highlight.b);
          doc.rect(margin, yPosition, contentWidth, rowHeight, 'F');
        }

        doc.text(descLines, margin + 4, yPosition + 6);
        
        if (item.amount !== 0 || !isHeader) {
          const priceText = `$${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const priceWidth = doc.getTextWidth(priceText);
          doc.text(priceText, pageWidth - margin - 4 - priceWidth, yPosition + 6);
        }

        doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
        doc.setLineWidth(0.1);
        doc.line(margin, yPosition + rowHeight, pageWidth - margin, yPosition + rowHeight);

        yPosition += rowHeight;
      });
    }

    // --- Footer / Totals ---
    yPosition += 5;
    
    const totalLabel = 'Total';
    const totalValue = `$${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    doc.setFillColor(colors.highlight.r, colors.highlight.g, colors.highlight.b);
    doc.rect(pageWidth - margin - 80, yPosition, 80, 12, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    
    doc.text(totalLabel, pageWidth - margin - 70, yPosition + 8);
    
    const totalWidth = doc.getTextWidth(totalValue);
    doc.text(totalValue, pageWidth - margin - 4 - totalWidth, yPosition + 8);

    yPosition += 20;

    // --- Quote Details / Kitchen Information ---
    if (quote && groupedInputs && quote.kitchenInformation) {
        // Add page if not enough space
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = margin;
        } else {
          // Separator title
           doc.setFont('helvetica', 'bold');
           doc.setFontSize(14);
           doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
           doc.text('DETAILS', margin, yPosition);
           yPosition += 10;
        }
        
        for (const categoryGroup of groupedInputs) {
          const hasData = categoryGroup.subcategories.some(sub =>
            sub.inputs.some(input => {
              const value = quote.kitchenInformation?.[input.name];
              return value !== null && value !== undefined && value !== false && value !== '' && value !== 'No';
            })
          );
  
          if (!hasData) continue;
  
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = margin;
          }
  
          // Category Title
          doc.setFillColor(colors.highlight.r, colors.highlight.g, colors.highlight.b); // Use highlight color
          doc.rect(margin, yPosition, contentWidth, 8, 'F');
          
          doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(categoryGroup.title.toUpperCase(), margin + 4, yPosition + 5.5);
          yPosition += 12;
  
          for (const subcategoryGroup of categoryGroup.subcategories) {
            const hasSubData = subcategoryGroup.inputs.some(input => {
              const value = quote.kitchenInformation?.[input.name];
              return value !== null && value !== undefined && value !== false && value !== '' && value !== 'No';
            });
  
            if (!hasSubData) continue;
  
            if (yPosition > pageHeight - 30) {
               doc.addPage();
               yPosition = margin;
            }

            // Subcategory Title
            if (subcategoryGroup.id !== 'default') {
              doc.setTextColor(colors.secondaryText.r, colors.secondaryText.g, colors.secondaryText.b);
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.text(subcategoryGroup.title, margin + 2, yPosition);
              yPosition += 6;
            }
  
            // Inputs
            for (const input of subcategoryGroup.inputs) {
              const value = quote.kitchenInformation?.[input.name];
              if (value === null || value === undefined || value === false || value === '' || value === 'No') {
                continue;
              }
  
              if (yPosition > pageHeight - 15) {
                doc.addPage();
                yPosition = margin;
              }
  
              doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
              doc.setLineWidth(0.1);
              doc.line(margin, yPosition + 6, margin + contentWidth, yPosition + 6);
  
              // Label
              doc.setTextColor(colors.secondaryText.r, colors.secondaryText.g, colors.secondaryText.b);
              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              
              const labelWidth = contentWidth * 0.65;
              const labelLines = doc.splitTextToSize(input.label, labelWidth);
              doc.text(labelLines, margin + 2, yPosition + 4);
  
              // Value
              doc.setFont('helvetica', 'bold');
              let displayValue = '';
              if (value === true) {
                displayValue = 'Yes';
                doc.setTextColor(colors.text.r, colors.text.g, colors.text.b); // Black for Yes
              } else if (value === false) {
                displayValue = 'No';
              } else {
                displayValue = String(value);
                if (input.unit) {
                  displayValue += ` ${input.unit}`;
                }
                doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
              }
              
              const valueWidth = doc.getTextWidth(displayValue);
              doc.text(displayValue, margin + contentWidth - valueWidth - 2, yPosition + 4);
  
              const rowHeight = Math.max(7, labelLines.length * 4 + 3);
              yPosition += rowHeight;
            }
             yPosition += 2;
          }
           yPosition += 4;
        }
    }

    // --- Materials Section (Requested) ---
    if (quote && quote.materials) {
       const materials = quote.materials as Materials;
       if (materials.file || (materials.items && materials.items.length > 0)) {
         if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = margin;
         }

         // Header
         doc.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b);
         doc.rect(margin, yPosition, contentWidth, 8, 'F');
         doc.setTextColor(colors.headerText.r, colors.headerText.g, colors.headerText.b);
         doc.setFontSize(11);
         doc.setFont('helvetica', 'bold');
         doc.text('MATERIALS', margin + 4, yPosition + 5.5);
         yPosition += 12;

         // If file (URL)
         if (materials.file) {
            doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            // Requirement: "Included materials" in English if URL present
            doc.text('Included materials', margin + 4, yPosition);
            yPosition += 6;
            
            // Optionally show the link text below for reference if printed? 
            // Or just the text as requested. I'll add the text.
            // If it's an image, logic in generateQuotePdf renders it. 
            // User just said "debe salir algo así: 'Incluido materiales'". 
            // I will leave it as just the text for now to be safe/clean.
         }

         // If items
         if (materials.items && materials.items.length > 0) {
            if (materials.file) yPosition += 4; // Spacer

            // Table Header
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.secondaryText.r, colors.secondaryText.g, colors.secondaryText.b);
            doc.text('Qty', margin + 4, yPosition);
            doc.text('Description', margin + 20, yPosition);
            yPosition += 5;

            for (const item of materials.items) {
               if (yPosition > pageHeight - 10) {
                  doc.addPage();
                  yPosition = margin;
               }
               
               doc.setFont('helvetica', 'bold');
               doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
               doc.text(String(item.quantity), margin + 4, yPosition);
               
               doc.setFont('helvetica', 'normal');
               doc.text(item.description, margin + 20, yPosition);
               
               yPosition += 6;
            }
         }
       }
    }

    // Save
    const fileName = `Invoice_${invoice.number || 'Draft'}_${new Date().getTime()}.pdf`;
    await this.savePdf(doc, fileName);
  }


  async generateQuotePdf(
    quote: Quote, 
    customer: QuoteCustomer | null, 
    groupedInputs: {
      id: string;
      title: string;
      subcategories: {
        id: string;
        title: string;
        inputs: KitchenInput[];
      }[];
    }[],
    userRole?: string
  ): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20; // Aumentado para mejor espaciado
    const contentWidth = pageWidth - margin * 2;
    let yPosition = margin;

    // Determinar si es customer (ocultar anotaciones y audios)
    const isCustomer = userRole === 'customer';
    const showFullDetails = !isCustomer; // estimator/admin ven todo

    // Colores de la marca
    const primaryColorR = 58;
    const primaryColorG = 115;
    const primaryColorB = 68; // #3A7344 (pine)
    const darkColorR = 51;
    const darkColorG = 47;
    const darkColorB = 40; // #332F28 (charcoal)
    const lightBgR = 234;
    const lightBgG = 209;
    const lightBgB = 186; // #EAD1BA (sand)

    // Clay color (#997A63) para labels uppercase de campos
    const clayColorR = 153;
    const clayColorG = 122;
    const clayColorB = 99;

    // Fog color (#BFBFBF) para bordes suaves
    const fogColorR = 191;
    const fogColorG = 191;
    const fogColorB = 191;

    const addPageIfNeeded = (expectedHeight: number) => {
      if (yPosition + expectedHeight > pageHeight - margin - 15) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Encabezado de sección con línea decorativa — replica "font-display text-2xl text-charcoal"
    const drawSectionTitle = (title: string) => {
      addPageIfNeeded(22);
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yPosition);
      // Subrayado pine fino
      const tw = doc.getTextWidth(title);
      doc.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
      doc.setLineWidth(0.6);
      doc.line(margin, yPosition + 4.5, margin + tw, yPosition + 4.5);
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      yPosition += 14;
    };

    // Encabezado de info-card (clay uppercase + hairline fog) — replica "text-sm font-bold uppercase tracking-widest text-clay"
    const drawInfoCardHeader = (x: number, y: number, width: number, title: string) => {
      doc.setTextColor(clayColorR, clayColorG, clayColorB);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), x + 5, y + 5);
      doc.setDrawColor(fogColorR, fogColorG, fogColorB);
      doc.setLineWidth(0.3);
      doc.line(x + 5, y + 8, x + width - 5, y + 8);
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
    };

    // Card de dato individual — replica "bg-fog/10 rounded-xl p-4 border border-fog/40"
    const drawDataCard = (x: number, y: number, w: number, h: number, label: string, value: string, isTrue: boolean) => {
      // Fondo cálido fog/10
      doc.setFillColor(245, 240, 234);
      doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
      // Borde fog
      doc.setDrawColor(fogColorR, fogColorG, fogColorB);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, h, 2.5, 2.5, 'S');
      // Label (clay uppercase xs bold)
      doc.setTextColor(clayColorR, clayColorG, clayColorB);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      const lblLines = doc.splitTextToSize(label.toUpperCase(), w - 8);
      doc.text(lblLines, x + 4, y + 4.5);
      const lblH = lblLines.length * 3.2;
      // Value (charcoal medium — pine si es true)
      if (isTrue) {
        doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
      } else {
        doc.setTextColor(darkColorR, darkColorG, darkColorB);
      }
      doc.setFontSize(9.5);
      doc.setFont('helvetica', isTrue ? 'bold' : 'normal');
      const valLines = doc.splitTextToSize(value, w - 8);
      doc.text(valLines, x + 4, y + 4.5 + lblH + 3);
    };

    /**
     * Renderiza un link de archivo/video/audio con tarjeta de marca.
     * Elimina la URL raw — solo muestra nombre amigable + enlace clicable.
     */
    const renderFileLink = (url: string, mediaType: 'Video' | 'Audio' | 'File' | 'Image' = 'File') => {
      addPageIfNeeded(14);
      const displayName = fileNameFromUrl(url) || `${mediaType} file`;

      // Fondo sand/fog con borde suave
      doc.setFillColor(245, 240, 234);
      doc.setDrawColor(fogColorR, fogColorG, fogColorB);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, yPosition, contentWidth, 11, 2.5, 2.5, 'FD');

      // Tipo de archivo en clay bold
      const typeLabel = mediaType.toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(clayColorR, clayColorG, clayColorB);
      doc.text(typeLabel, margin + 4, yPosition + 7);
      const typeLabelW = doc.getTextWidth(typeLabel);

      // Separador vertical fino
      doc.setDrawColor(fogColorR, fogColorG, fogColorB);
      doc.setLineWidth(0.3);
      doc.line(margin + 4 + typeLabelW + 3, yPosition + 2.5, margin + 4 + typeLabelW + 3, yPosition + 8.5);

      // Nombre amigable como link en pine (sin íconos unicode)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
      const truncatedName = displayName.length > 55
        ? displayName.substring(0, 52) + '...'
        : displayName;
      doc.textWithLink(truncatedName, margin + 4 + typeLabelW + 7, yPosition + 7, { url });

      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      yPosition += 14;
    };

    /** Elimina query string antes de testear extensión (S3 presigned URLs). */
    const urlWithoutQuery = (url: string) => url.split('?')[0];
    const isImageFile = (url: string) => /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(urlWithoutQuery(url));
    const isVideoFile = (url: string) => /\.(mp4|mov|mkv|avi|webm)$/i.test(urlWithoutQuery(url));

    const fileNameFromUrl = (url: string): string => {
      try {
        const parts = urlWithoutQuery(url).split('/');
        const rawName = decodeURIComponent(parts.pop() || url);
        // Eliminar cadena(s) de dígitos separadas por guión al inicio + UUID
        const clean = rawName
          .replace(/^(\d+[-])+\d*[_-]?/, '')     // "177...-177...-xxx_"  → lo que quede
          .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[_-]?/i, '');
        // Si el nombre quedó vacío o demasiado corto (< 4 chars sin extensión), usar rawName truncado
        const nameWithoutExt = (clean || '').replace(/\.[^.]+$/, '');
        if (!clean || nameWithoutExt.length < 3) {
          // Mostrar últimos ~30 caracteres del rawName como fallback
          const suffix = rawName.length > 30 ? '...' + rawName.slice(-27) : rawName;
          return suffix;
        }
        return clean;
      } catch {
        return url;
      }
    };

    const renderFullWidthImage = async (url: string, label?: string) => {
      try {
        console.log('[PDF] Attempting to load image:', url);
        const imgDataUrl = await this.getImageFromUrl(url);
        
        if (!imgDataUrl || !imgDataUrl.startsWith('data:')) {
          throw new Error('Invalid image data URL');
        }
        
        console.log('[PDF] Image loaded, getting properties...');
        const imgProps = doc.getImageProperties(imgDataUrl);
        console.log('[PDF] Image properties:', imgProps);
        const ratio = imgProps.width / imgProps.height;
        
        // Calcular dimensiones para ancho completo - ocupar todo el ancho disponible
        const imgWidth = contentWidth; // Ancho completo sin márgenes adicionales
        let imgHeight = imgWidth / ratio;
        
        // Limitar altura máxima para que quepa en la página (dejar espacio para label si existe)
        const spaceForLabel = label ? 8 : 0;
        const maxHeight = pageHeight - margin - yPosition - spaceForLabel - 10;
        
        if (imgHeight > maxHeight) {
          // Si es muy alta, ajustar para que quepa pero mantener proporción
          imgHeight = maxHeight;
          const adjustedWidth = imgHeight * ratio;
          const xOffset = (contentWidth - adjustedWidth) / 2;
          addPageIfNeeded(imgHeight + spaceForLabel + 15);
          
          // Borde alrededor de la imagen
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin + xOffset - 1, yPosition - 1, adjustedWidth + 2, imgHeight + 2, 2, 2, 'S');
          
          console.log('[PDF] Adding image (adjusted size):', adjustedWidth, 'x', imgHeight);
          doc.addImage(imgDataUrl, 'JPEG', margin + xOffset, yPosition, adjustedWidth, imgHeight);
          yPosition += imgHeight + 6;
        } else {
          addPageIfNeeded(imgHeight + spaceForLabel + 15);
          
          // Borde alrededor de la imagen - ancho completo
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin - 1, yPosition - 1, imgWidth + 2, imgHeight + 2, 2, 2, 'S');
          
          console.log('[PDF] Adding image (full width):', imgWidth, 'x', imgHeight);
          // Imagen ocupando todo el ancho disponible
          doc.addImage(imgDataUrl, 'JPEG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 6;
        }
        
        console.log('[PDF] Image added successfully');
        
        // Si hay label, mostrarlo debajo
        if (label) {
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text(label, margin, yPosition);
          yPosition += 6;
        }
      } catch (error) {
        console.error('Error rendering image in PDF:', error);
        // Si no se puede renderizar la imagen, mostrar solo un placeholder de texto (sin link)
        addPageIfNeeded(8);
        const fallbackLabel = label || fileNameFromUrl(url);
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Image could not be loaded: ${fallbackLabel}`, margin, yPosition);
        yPosition += 10;
      }
    };

    // ── HEADER ── compacto: barra pine superior + fondo sand
    const headerH = 36;

    // Barra pine fina (3mm) — señal de marca
    doc.setFillColor(primaryColorR, primaryColorG, primaryColorB);
    doc.rect(0, 0, pageWidth, 3, 'F');

    // Fondo sand
    doc.setFillColor(lightBgR, lightBgG, lightBgB);
    doc.rect(0, 3, pageWidth, headerH - 3, 'F');

    // "BA" charcoal + "Kitchen & Bath Design" pine
    doc.setTextColor(darkColorR, darkColorG, darkColorB);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('BA', margin, 18);
    const baW = doc.getTextWidth('BA');
    doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
    doc.text(' Kitchen & Bath Design', margin + baW, 18);

    // Subtítulo alineado a la derecha
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(83, 83, 83);
    const subTitle = 'PROFESSIONAL ESTIMATE REPORT';
    const subW = doc.getTextWidth(subTitle);
    doc.text(subTitle, pageWidth - margin - subW, 18);

    // Línea pine cierra el header
    doc.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
    doc.setLineWidth(0.6);
    doc.line(0, headerH, pageWidth, headerH);

    yPosition = headerH + 10;

    // ── HERO: solo título \"Estimate vN\" y total a la derecha ──
    doc.setTextColor(darkColorR, darkColorG, darkColorB);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Estimate ', margin, yPosition);
    const estimateLabelW = doc.getTextWidth('Estimate ');
    doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
    doc.text(`v${quote.versionNumber}`, margin + estimateLabelW, yPosition);
    doc.setTextColor(darkColorR, darkColorG, darkColorB);

    // Total cost alineado a la derecha
    const totalStr = `$${(quote.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(clayColorR, clayColorG, clayColorB);
    const totalLabelW = doc.getTextWidth('TOTAL COST');
    doc.text('TOTAL COST', pageWidth - margin - totalLabelW, yPosition - 6);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColorR, darkColorG, darkColorB);
    const totalStrW = doc.getTextWidth(totalStr);
    doc.text(totalStr, pageWidth - margin - totalStrW, yPosition);

    yPosition += 6;

    // Fecha
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(83, 83, 83); // slate
    doc.text(this.formatDate(quote.createdAt), margin, yPosition);
    yPosition += 14;

    // ── TARJETAS DE INFO: Customer Information + Project Details ──
    const infoBoxHeight = 42;
    const infoGap = 8;
    const boxWidth = (contentWidth - infoGap) / 2;

    // Customer card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(fogColorR, fogColorG, fogColorB);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, yPosition, boxWidth, infoBoxHeight, 4, 4, 'FD');
    drawInfoCardHeader(margin, yPosition, boxWidth, 'Customer Information');

    if (customer) {
      let iy = yPosition + 13;
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      doc.setFontSize(8.5);
      // Name
      doc.setFont('helvetica', 'bold');
      doc.text(customer.name, margin + 5, iy);
      iy += 6;
      if (customer.email) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
        doc.text(customer.email, margin + 5, iy);
        doc.setTextColor(darkColorR, darkColorG, darkColorB);
        iy += 6;
      }
      if (customer.phone) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(83, 83, 83);
        doc.text(customer.phone, margin + 5, iy);
        doc.setTextColor(darkColorR, darkColorG, darkColorB);
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(83, 83, 83);
      doc.text('No customer information', margin + 5, yPosition + 14);
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
    }

    // Project details card
    const projX = margin + boxWidth + infoGap;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(fogColorR, fogColorG, fogColorB);
    doc.setLineWidth(0.4);
    doc.roundedRect(projX, yPosition, boxWidth, infoBoxHeight, 4, 4, 'FD');
    drawInfoCardHeader(projX, yPosition, boxWidth, 'Project Details');

    let py = yPosition + 13;
    doc.setFontSize(8.5);
    doc.setTextColor(83, 83, 83); // slate label
    doc.setFont('helvetica', 'normal');
    doc.text('Experience Level', projX + 5, py);
    py += 4;
    doc.setTextColor(darkColorR, darkColorG, darkColorB);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(quote.experience.charAt(0).toUpperCase() + quote.experience.slice(1), projX + 5, py);
    py += 7;
    if (quote.notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(83, 83, 83);
      const notesLines = doc.splitTextToSize(quote.notes, boxWidth - 10);
      doc.text(notesLines.slice(0, 2), projX + 5, py);
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
    }

    yPosition += infoBoxHeight + 12;

    // === SECCIÓN 1: Kitchen Information (campos dinámicos) ===
    if (quote.kitchenInformation) {
      for (const categoryGroup of groupedInputs) {
        const hasData = categoryGroup.subcategories.some(sub =>
          sub.inputs.some(input => {
            const value = quote.kitchenInformation?.[input.name];
            return value !== null && value !== undefined && value !== false && value !== '' && value !== 'No';
          })
        );

        if (!hasData) continue;

        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = margin;
        }

        // Título de categoría — charcoal bold con subrayado pine (replica "font-display text-2xl text-charcoal")
        addPageIfNeeded(22);
        doc.setTextColor(darkColorR, darkColorG, darkColorB);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(categoryGroup.title, margin, yPosition);
        const catTitleW = doc.getTextWidth(categoryGroup.title);
        doc.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition + 4.5, margin + catTitleW, yPosition + 4.5);
        doc.setTextColor(darkColorR, darkColorG, darkColorB);
        yPosition += 12;

        for (const subcategoryGroup of categoryGroup.subcategories) {
          const hasSubData = subcategoryGroup.inputs.some(input => {
            const value = quote.kitchenInformation?.[input.name];
            return value !== null && value !== undefined && value !== false && value !== '' && value !== 'No';
          });

          if (!hasSubData) continue;

          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = margin;
          }

          // Sub-sección — clay uppercase con hairline fog (replica "text-sm font-bold uppercase tracking-widest text-clay")
          if (subcategoryGroup.id !== 'default') {
            addPageIfNeeded(14);
            doc.setTextColor(clayColorR, clayColorG, clayColorB);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(subcategoryGroup.title.toUpperCase(), margin, yPosition);
            doc.setDrawColor(fogColorR, fogColorG, fogColorB);
            doc.setLineWidth(0.3);
            doc.line(margin, yPosition + 3.5, margin + contentWidth, yPosition + 3.5);
            yPosition += 9;
          }

          // Recopilar items válidos
          const validItems: Array<{ input: KitchenInput; value: unknown; displayValue: string }> = [];

          for (const input of subcategoryGroup.inputs) {
            const value = quote.kitchenInformation?.[input.name];
            if (value === null || value === undefined || value === false || value === '' || value === 'No') {
              continue;
            }
            // Filtrar valores "none" (campo no aplica)
            if (typeof value === 'string') {
              const lc = value.toLowerCase().trim();
              if (lc === 'none' || lc === 'no' || lc === 'n/a') continue;
            }
            let displayValue = '';
            if (value === true) {
              displayValue = 'Yes';
            } else {
              displayValue = String(value);
              if (input.unit) displayValue += ` ${input.unit}`;
            }
            // Filtrar displayValue que empieza con "none" (ej: "none LF")
            const dvLower = displayValue.toLowerCase().trim();
            if (dvLower === 'none' || dvLower.startsWith('none ')) continue;
            validItems.push({ input, value, displayValue });
          }

          // Renderizar como grid de cards (3 columnas) — replica "grid grid-cols-3 gap-6" de la pantalla
          if (validItems.length > 0) {
            const cardCols = 3;
            const cardGap = 3;
            const cardPadX = 4;
            const cardPadY = 3.5;
            const cw = (contentWidth - cardGap * (cardCols - 1)) / cardCols;

            // Agrupar en filas
            for (let rowStart = 0; rowStart < validItems.length; rowStart += cardCols) {
              const rowItems = validItems.slice(rowStart, rowStart + cardCols);

              // Calcular altura de cada card de la fila
              const rowHeights = rowItems.map(item => {
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'bold');
                const lbl = doc.splitTextToSize(item.input.label.toUpperCase(), cw - cardPadX * 2);
                doc.setFontSize(9.5);
                doc.setFont('helvetica', 'normal');
                const val = doc.splitTextToSize(item.displayValue, cw - cardPadX * 2);
                return Math.max(20, cardPadY + lbl.length * 3.2 + 3 + val.length * 5 + cardPadY);
              });

              const rowH = Math.max(...rowHeights);
              addPageIfNeeded(rowH + 5);

              rowItems.forEach((item, j) => {
                const cx = margin + j * (cw + cardGap);
                drawDataCard(cx, yPosition, cw, rowH, item.input.label, item.displayValue, item.value === true);
              });

              yPosition += rowH + 4;
            }

            yPosition += 4;
          }
        }

        yPosition += 6;
      }
    }

    // === SECCIÓN 2: Countertops Files ===
    // === SECCIÓN 3: Backsplash Files ===
    // === SECCIÓN 4: Audio Notes ===
    // === SECCIÓN 5: Sketches ===
    // === SECCIÓN 6: Additional Comments & Media ===
    // === SECCIÓN 7: Materials ===
    
    // Preparar datos de media (orden del formulario)
    const kitchenInfo = quote.kitchenInformation || {};
    
    // Countertops Files — leer desde top-level primero, luego kitchenInformation como fallback
    let countertopsFiles: string[] = [];
    if (quote.countertopsFiles && Array.isArray(quote.countertopsFiles) && quote.countertopsFiles.length > 0) {
      countertopsFiles = quote.countertopsFiles;
    } else if (kitchenInfo['countertopsFiles'] && Array.isArray(kitchenInfo['countertopsFiles']) && (kitchenInfo['countertopsFiles'] as string[]).length > 0) {
      countertopsFiles = kitchenInfo['countertopsFiles'] as string[];
    }

    // Backsplash Files — leer desde top-level primero, luego kitchenInformation como fallback
    let backsplashFiles: string[] = [];
    if (quote.backsplashFiles && Array.isArray(quote.backsplashFiles) && quote.backsplashFiles.length > 0) {
      backsplashFiles = quote.backsplashFiles;
    } else if (kitchenInfo['backsplashFiles'] && Array.isArray(kitchenInfo['backsplashFiles']) && (kitchenInfo['backsplashFiles'] as string[]).length > 0) {
      backsplashFiles = kitchenInfo['backsplashFiles'] as string[];
    }

    // Audio Notes (ahora es array) — top-level primero, luego kitchenInformation
    let audioNotesArray: { url: string; transcription?: string; summary?: string }[] = [];
    const audioNotesData = quote.audioNotes || kitchenInfo['audioNotes'];
    if (audioNotesData) {
      if (Array.isArray(audioNotesData)) {
        audioNotesArray = audioNotesData;
      } else if (typeof audioNotesData === 'object' && 'url' in audioNotesData) {
        // Compatibilidad: convertir objeto único a array
        audioNotesArray = [audioNotesData as { url: string; transcription?: string; summary?: string }];
      }
    }
    
    // Sketches: pueden estar en quote.sketchFiles o en kitchenInformation
    let sketches: string[] = [];
    if (quote.sketchFiles && Array.isArray(quote.sketchFiles) && quote.sketchFiles.length > 0) {
      sketches = quote.sketchFiles;
    } else if (kitchenInfo['sketchFiles'] && Array.isArray(kitchenInfo['sketchFiles']) && kitchenInfo['sketchFiles'].length > 0) {
      sketches = kitchenInfo['sketchFiles'] as string[];
    } else if (kitchenInfo['sketchFile'] && typeof kitchenInfo['sketchFile'] === 'string') {
      sketches = [kitchenInfo['sketchFile'] as string];
    }
    
    // Additional Comments Media
    const additionalComments = (kitchenInfo['additionalComments'] || quote.additionalComments || {}) as Record<string, unknown>;
    let additionalMedia: string[] = [];
    const mediaFiles = additionalComments['mediaFiles'] || (additionalComments as any).mediaFiles;
    if (mediaFiles && Array.isArray(mediaFiles)) {
      additionalMedia = mediaFiles as string[];
    }
    const additionalCommentText = additionalComments['comment'] || (additionalComments as any).comment;

    console.log('[PDF] Media data check:');
    console.log('[PDF] - countertopsFiles:', countertopsFiles);
    console.log('[PDF] - backsplashFiles:', backsplashFiles);
    console.log('[PDF] - audioNotesArray:', audioNotesArray);
    console.log('[PDF] - sketches:', sketches);
    console.log('[PDF] - additionalMedia:', additionalMedia);
    console.log('[PDF] - additionalCommentText:', additionalCommentText);

    // === SECCIÓN 2: Countertops Files ===
    if (countertopsFiles && countertopsFiles.length > 0) {
      drawSectionTitle('Countertops Files');
      
      console.log('[PDF] Rendering countertops files, count:', countertopsFiles.length);
      
      for (let i = 0; i < countertopsFiles.length; i++) {

        const file = countertopsFiles[i];
        if (!file) continue;
        
        if (isImageFile(file)) {
          const imgLabel = countertopsFiles.length > 1 ? `Countertop ${i + 1} of ${countertopsFiles.length}` : 'Countertop';
          await renderFullWidthImage(file, imgLabel);
          yPosition += 4;
        } else {
          renderFileLink(file, isVideoFile(file) ? 'Video' : 'File');
        }
      }
      yPosition += 4;
    }

    // === SECCIÓN 3: Backsplash Files ===
    if (backsplashFiles && backsplashFiles.length > 0) {
      console.log('[PDF] Rendering backsplash files, count:', backsplashFiles.length);
      drawSectionTitle('Backsplash Files');

      for (let i = 0; i < backsplashFiles.length; i++) {
        const file = backsplashFiles[i];
        if (!file) continue;
        
        if (isImageFile(file)) {
          const imgLabel = backsplashFiles.length > 1 ? `Backsplash ${i + 1} of ${backsplashFiles.length}` : 'Backsplash';
          await renderFullWidthImage(file, imgLabel);
          yPosition += 4;
        } else {
          renderFileLink(file, isVideoFile(file) ? 'Video' : 'File');
        }
      }
      yPosition += 4;
    }

    // === SECCIÓN 7: Materials ===
    if (quote.materials) {
      const materials = quote.materials as Materials;
      const hasMaterialsFile = !!materials.file;
      const hasMaterialsItems = !!(materials.items && materials.items.length > 0);

      if (hasMaterialsFile || hasMaterialsItems) {
        drawSectionTitle('Materials List');

        // Materials File
        if (hasMaterialsFile && materials.file) {
          doc.setTextColor(darkColorR, darkColorG, darkColorB);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Materials File', margin + 2, yPosition);
          yPosition += 6;

          const fileUrl = materials.file;
          if (isImageFile(fileUrl)) {
            await renderFullWidthImage(fileUrl);
          } else {
            renderFileLink(fileUrl, 'File');
          }
        }

        // Materials Items
        if (hasMaterialsItems && materials.items) {
          addPageIfNeeded(18);
          doc.setTextColor(darkColorR, darkColorG, darkColorB);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Materials Items', margin + 2, yPosition);
          yPosition += 8;

          const rowHeight = 8;
          const col1Width = contentWidth * 0.25; // Quantity
          const col2Width = contentWidth * 0.75; // Description

          // Header de tabla
          doc.setFillColor(240, 240, 240);
          doc.rect(margin + 2, yPosition - 4, contentWidth - 4, rowHeight, 'F');
          
          doc.setTextColor(darkColorR, darkColorG, darkColorB);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Quantity', margin + 4, yPosition);
          doc.text('Description', margin + col1Width + 4, yPosition);
          yPosition += rowHeight + 2;

          for (const item of materials.items) {
            addPageIfNeeded(15);

            // Línea separadora
            doc.setDrawColor(240, 240, 240);
            doc.setLineWidth(0.1);
            doc.line(margin + 2, yPosition - 2, margin + contentWidth - 2, yPosition - 2);

            doc.setTextColor(darkColorR, darkColorG, darkColorB);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(String(item.quantity), margin + 4, yPosition);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            const descLines = doc.splitTextToSize(item.description, col2Width - 8);
            doc.text(descLines, margin + col1Width + 4, yPosition);

            const itemHeight = Math.max(rowHeight, descLines.length * 4 + 2);
            yPosition += itemHeight;
          }

          yPosition += 6;
        }
      }
    }

    // === SECCIÓN 4: Audio Notes === (solo para estimator/admin)
    if (audioNotesArray && audioNotesArray.length > 0 && showFullDetails) {
      console.log('[PDF] Rendering audio notes, count:', audioNotesArray.length);
      drawSectionTitle('Audio Notes');

      for (let i = 0; i < audioNotesArray.length; i++) {
        const audioNote = audioNotesArray[i];
        if (!audioNote || !audioNote.url) continue;
        
        console.log(`[PDF] Rendering audio note ${i + 1}:`, audioNote.url);
        addPageIfNeeded(20);
        
        // Título del audio individual
        doc.setTextColor(darkColorR, darkColorG, darkColorB);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const audioTitle = audioNotesArray.length > 1 ? `Audio Note ${i + 1} of ${audioNotesArray.length}` : 'Audio Note';
        doc.text(audioTitle, margin + 2, yPosition);
        yPosition += 6;

        renderFileLink(audioNote.url, 'Audio');
        
        // Mostrar summary y transcription si existen
        if (audioNote.summary || audioNote.transcription) {
          addPageIfNeeded(25);
          
          if (audioNote.summary) {
            doc.setTextColor(darkColorR, darkColorG, darkColorB);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Summary:', margin + 4, yPosition);
            yPosition += 5;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            const summaryLines = doc.splitTextToSize(audioNote.summary, contentWidth - 8);
            doc.text(summaryLines, margin + 4, yPosition);
            yPosition += (summaryLines.length * 4) + 4;
          }
          
          if (audioNote.transcription) {
            doc.setTextColor(darkColorR, darkColorG, darkColorB);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Transcription:', margin + 4, yPosition);
            yPosition += 5;
            
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            const transcriptionLines = doc.splitTextToSize(audioNote.transcription, contentWidth - 8);
            doc.text(transcriptionLines, margin + 4, yPosition);
            yPosition += (transcriptionLines.length * 3.5) + 4;
          }
        }
        
        yPosition += 4; // Espacio entre audios
      }
    }

    // === SECCIÓN 5: Sketches ===
    if (sketches && sketches.length > 0) {
      console.log('[PDF] Rendering sketches, count:', sketches.length);
      drawSectionTitle('Sketches & Drawings');
      
      for (let i = 0; i < sketches.length; i++) {
        const sketch = sketches[i];
        if (!sketch) continue;
        
        console.log(`[PDF] Rendering sketch ${i + 1}:`, sketch);
        const label = sketches.length > 1 ? `Sketch ${i + 1} of ${sketches.length}` : 'Sketch';
        try {
          await renderFullWidthImage(sketch, label);
          yPosition += 4; // Espacio entre sketches
        } catch (error) {
          console.error(`[PDF] Error rendering sketch ${i + 1}:`, error);
          // Continuar con el siguiente
        }
      }
    }

    // === SECCIÓN 6: Additional Comments & Media === (solo para estimator/admin)
    if ((additionalCommentText || (additionalMedia && additionalMedia.length > 0)) && showFullDetails) {
      drawSectionTitle('Additional Comments & Media');
      
      // Additional Comment Text
      if (additionalCommentText) {
        addPageIfNeeded(20);
        doc.setTextColor(darkColorR, darkColorG, darkColorB);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Comments', margin + 2, yPosition);
        yPosition += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const commentLines = doc.splitTextToSize(String(additionalCommentText), contentWidth - 4);
        doc.text(commentLines, margin + 2, yPosition);
        yPosition += (commentLines.length * 4) + 6;
      }
      
      // Additional Media Files
      if (additionalMedia && additionalMedia.length > 0) {
        console.log('[PDF] Rendering additional media, count:', additionalMedia.length);
        addPageIfNeeded(15);
        doc.setTextColor(darkColorR, darkColorG, darkColorB);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Photos & Videos', margin + 2, yPosition);
        yPosition += 8;

        for (const media of additionalMedia) {
          if (!media) continue;
          
          if (isImageFile(media)) {
            await renderFullWidthImage(media);
          } else {
            renderFileLink(media, isVideoFile(media) ? 'Video' : 'File');
          }
        }
        yPosition += 4;
      }
    }

    // Footer en cada página
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} of ${totalPages} - Generated on ${new Date().toLocaleDateString('en-US')}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Descargar el PDF
    const fileName = `Estimate_${quote.category}_v${quote.versionNumber}_${new Date().getTime()}.pdf`;
    await this.savePdf(doc, fileName);
  }

  /**
   * Guarda el PDF según la plataforma:
   * - En web: usa doc.save() (descarga directa)
   * - En iOS/Android: usa Filesystem para guardar y luego abre el share sheet
   */
  private async savePdf(doc: jsPDF, fileName: string): Promise<void> {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    
    if (isNative) {
      try {
        // Convertir PDF a base64
        const pdfBlob = doc.output('blob');
        const base64Data = await this.blobToBase64(pdfBlob);
        
        // Guardar en el directorio de documentos usando Filesystem
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        
        console.log('[PDF] Archivo guardado en:', result.uri);
        
        // En iOS, abrir el share sheet para que el usuario pueda compartir/guardar
        if (platform === 'ios') {
          try {
            await Share.share({
              title: fileName,
              text: 'Compartir PDF',
              url: result.uri,
              dialogTitle: 'Compartir PDF'
            });
          } catch (shareError) {
            // Si el usuario cancela el share, no es un error crítico
            console.log('[PDF] Usuario canceló el share o no disponible:', shareError);
          }
        }
        
      } catch (error) {
        console.error('[PDF] Error al guardar PDF en dispositivo nativo:', error);
        // Fallback: intentar con save() por si acaso
        try {
          doc.save(fileName);
        } catch (fallbackError) {
          console.error('[PDF] Error en fallback también:', fallbackError);
          throw error;
        }
      }
    } else {
      // En web, usar el método estándar de jsPDF
      doc.save(fileName);
    }
  }

  /**
   * Convierte un Blob a base64 string
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remover el prefijo data:application/pdf;base64,
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Error al convertir blob a base64'));
      reader.readAsDataURL(blob);
    });
  }

  private formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private async getImageFromUrl(url: string): Promise<string> {
    // Estrategia 1: Proxy del backend — evita CORS en S3
    // El backend descarga la imagen desde S3 y la sirve al browser
    try {
      const proxyUrl = `${this.apiUrl}/upload/image-proxy?url=${encodeURIComponent(url)}`;
      const blob = await firstValueFrom(
        this.http.get(proxyUrl, { responseType: 'blob' })
      );
      return await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result as string);
        reader.onerror = () => rej(new Error('FileReader error'));
        reader.readAsDataURL(blob);
      });
    } catch (proxyErr) {
      console.warn('[PDF] backend proxy failed, trying direct fetch:', proxyErr);
    }

    // Estrategia 2: fetch directo con CORS
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result as string);
        reader.onerror = () => rej(new Error('FileReader error'));
        reader.readAsDataURL(blob);
      });
    } catch (fetchErr) {
      console.warn('[PDF] direct fetch failed, trying Image element:', fetchErr);
    }

    // Estrategia 3: Image element con crossOrigin (último recurso)
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No canvas context');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error(`Could not load image from ${url}`));
      img.src = url;
    });
  }
}

