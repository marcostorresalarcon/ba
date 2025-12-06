import { Injectable } from '@angular/core';
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

@Injectable({
  providedIn: 'root'
})
export class PdfService {
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


  async generateQuotePdf(quote: Quote, customer: QuoteCustomer | null, groupedInputs: {
    id: string;
    title: string;
    subcategories: {
      id: string;
      title: string;
      inputs: KitchenInput[];
    }[];
  }[]): Promise<void> {
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

    const addPageIfNeeded = (expectedHeight: number) => {
      if (yPosition + expectedHeight > pageHeight - margin - 15) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    const drawBorderedBox = (x: number, y: number, width: number, height: number, title?: string, titleBgColor?: number[]) => {
      // Borde principal más visible
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, width, height, 3, 3, 'S');
      
      // Si hay título, dibujar header con fondo
      if (title && titleBgColor) {
        const headerHeight = 8;
        doc.setFillColor(titleBgColor[0], titleBgColor[1], titleBgColor[2]);
        doc.roundedRect(x, y, width, headerHeight, 3, 3, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), x + 5, y + 5.5);
        
        // Línea separadora debajo del header
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(x, y + headerHeight, x + width, y + headerHeight);
      }
    };

    const drawSectionTitle = (title: string) => {
      addPageIfNeeded(20);
      
      // Fondo de sección con borde
      const sectionHeight = 12;
      doc.setFillColor(primaryColorR, primaryColorG, primaryColorB);
      doc.roundedRect(margin, yPosition, contentWidth, sectionHeight, 2, 2, 'F');
      
      // Borde más visible
      doc.setDrawColor(primaryColorR - 20, primaryColorG - 20, primaryColorB - 20);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, yPosition, contentWidth, sectionHeight, 2, 2, 'S');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), margin + 8, yPosition + 8);
      yPosition += sectionHeight + 8; // Más espacio después del título
    };

    const renderLink = (label: string, url: string) => {
      doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.textWithLink(label, margin + 4, yPosition, { url });
      yPosition += 6;
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
    };

    const fileNameFromUrl = (url: string): string => {
      try {
        const clean = decodeURIComponent(url);
        const parts = clean.split('/');
        return parts.pop() || clean;
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
        // Fallback a link con mejor formato
        addPageIfNeeded(10);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPosition, contentWidth, 8, 2, 2, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, yPosition, contentWidth, 8, 2, 2, 'S');
        
        const label = fileNameFromUrl(url);
        doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.textWithLink(label, margin + 4, yPosition + 5.5, { url });
        yPosition += 12;
      }
    };

    // Header con logo y título
    // Fondo completo del header
    doc.setFillColor(lightBgR, lightBgG, lightBgB);
    doc.rect(0, 0, pageWidth, 50, 'F'); // Altura aumentada

    // Logo placeholder o texto grande de marca
    doc.setTextColor(darkColorR, darkColorG, darkColorB);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('BA Kitchen & Bath Design', margin, 25);

    // Subtítulo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('PROFESSIONAL ESTIMATE REPORT', margin, 35);
    
    // Línea decorativa
    doc.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
    doc.setLineWidth(0.5);
    doc.line(margin, 42, pageWidth - margin, 42);

    yPosition = 60; // Inicio del contenido más abajo

    // Información del Quote
    doc.setFillColor(primaryColorR, primaryColorG, primaryColorB);
    doc.rect(margin, yPosition, contentWidth, 10, 'F'); // Altura aumentada
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    // Centrar texto del título
    const title = `Estimate v${quote.versionNumber} - ${quote.category.toUpperCase()}`;
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, margin + (contentWidth - titleWidth) / 2, yPosition + 7);

    yPosition += 14; // Espacio aumentado

    // Información del Cliente y Proyecto
    const infoBoxHeight = 40;
    const boxWidth = (contentWidth - 8) / 2;

    // Box Cliente - Con bordes visibles
    drawBorderedBox(margin, yPosition, boxWidth, infoBoxHeight, 'CUSTOMER INFORMATION', [primaryColorR, primaryColorG, primaryColorB]);

    if (customer) {
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      let infoY = yPosition + 12;
      
      // Name
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(customer.name, margin + 22, infoY);
      infoY += 7;
      
      // Email
      if (customer.email) {
        doc.setFont('helvetica', 'bold');
        doc.text('Email:', margin + 5, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(customer.email, margin + 22, infoY);
        infoY += 7;
      }
      
      // Phone
      if (customer.phone) {
        doc.setFont('helvetica', 'bold');
        doc.text('Phone:', margin + 5, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(customer.phone, margin + 22, infoY);
      }
    } else {
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('No customer information', margin + 5, yPosition + 12);
    }

    // Box Proyecto - Con bordes visibles
    const projX = margin + boxWidth + 8;
    drawBorderedBox(projX, yPosition, boxWidth, infoBoxHeight, 'PROJECT DETAILS', [darkColorR, darkColorG, darkColorB]);

    doc.setTextColor(darkColorR, darkColorG, darkColorB);
    doc.setFontSize(9);
    
    let projY = yPosition + 12;
    
    // Experience
    doc.setFont('helvetica', 'bold');
    doc.text('Experience:', projX + 5, projY);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.experience, projX + 28, projY);
    projY += 7;
    
    // Status
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', projX + 5, projY);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.status.toUpperCase(), projX + 28, projY);
    projY += 7;
    
    // Date
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', projX + 5, projY);
    doc.setFont('helvetica', 'normal');
    doc.text(this.formatDate(quote.createdAt), projX + 28, projY);

    yPosition += infoBoxHeight + 12;

    // Total Price destacado con borde
    doc.setFillColor(primaryColorR, primaryColorG, primaryColorB);
    doc.roundedRect(margin, yPosition, contentWidth, 18, 3, 3, 'F');
    
    // Borde más visible
    doc.setDrawColor(primaryColorR - 30, primaryColorG - 30, primaryColorB - 30);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, yPosition, contentWidth, 18, 3, 3, 'S');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('TOTAL ESTIMATE', margin + 8, yPosition + 8);
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `$${(quote.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      margin + 8,
      yPosition + 16
    );

    yPosition += 26;

    // Notas si existen - Con borde
    if (quote.notes) {
      addPageIfNeeded(30);
      
      const notesHeight = 25;
      drawBorderedBox(margin, yPosition, contentWidth, notesHeight, 'NOTES', [primaryColorR, primaryColorG, primaryColorB]);
      
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const notesLines = doc.splitTextToSize(quote.notes, contentWidth - 10);
      doc.text(notesLines, margin + 5, yPosition + 14);
      
      const actualHeight = Math.max(notesHeight, (notesLines.length * 4) + 18);
      yPosition += actualHeight + 8;
    }

    // === SECCIÓN 1: Kitchen Information (campos dinámicos) ===
    if (quote.kitchenInformation) {
      for (const categoryGroup of groupedInputs) {
        // Verificar si la categoría tiene datos
        const hasData = categoryGroup.subcategories.some(sub =>
          sub.inputs.some(input => {
            const value = quote.kitchenInformation?.[input.name];
            return value !== null && value !== undefined && value !== false && value !== '' && value !== 'No';
          })
        );

        if (!hasData) continue;

        // Verificar si necesitamos nueva página
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = margin;
        }

        // Título de categoría - Estilo de sección principal
        // Línea divisoria superior con título
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition + 8, margin + contentWidth, yPosition + 8);
        
        // Fondo del título
        doc.setFillColor(primaryColorR, primaryColorG, primaryColorB);
        doc.path([
          { op: 'm', c: [margin, yPosition + 8] },
          { op: 'l', c: [margin, yPosition + 2] },
          { op: 'c', c: [margin, yPosition, margin, yPosition, margin + 2, yPosition] },
          { op: 'l', c: [margin + contentWidth/2, yPosition] }, // Ancho parcial para estilo moderno
          { op: 'l', c: [margin + contentWidth/2 + 5, yPosition + 8] }, // Corte diagonal
          { op: 'l', c: [margin, yPosition + 8] }
        ], 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(categoryGroup.title.toUpperCase(), margin + 6, yPosition + 6);
        yPosition += 14;

        for (const subcategoryGroup of categoryGroup.subcategories) {
          const hasSubData = subcategoryGroup.inputs.some(input => {
            const value = quote.kitchenInformation?.[input.name];
            return value !== null && value !== undefined && value !== false && value !== '' && value !== 'No';
          });

          if (!hasSubData) continue;

          // Verificar si necesitamos nueva página
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = margin;
          }

          // Subtítulo si no es default
          if (subcategoryGroup.id !== 'default') {
            doc.setTextColor(darkColorR, darkColorG, darkColorB);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(subcategoryGroup.title, margin + 3, yPosition);
            yPosition += 5;
          }

          // Items de la subcategoría - Con bordes y mejor espaciado
          
          for (const input of subcategoryGroup.inputs) {
            const value = quote.kitchenInformation?.[input.name];
            if (value === null || value === undefined || value === false || value === '' || value === 'No') {
              continue;
            }

            addPageIfNeeded(12);

            // Fondo sutil para cada fila
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(margin, yPosition, contentWidth, 10, 1, 1, 'F');
            
            // Borde de la fila
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.roundedRect(margin, yPosition, contentWidth, 10, 1, 1, 'S');

            // Label
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            
            const labelWidth = contentWidth * 0.65;
            const labelLines = doc.splitTextToSize(input.label, labelWidth);
            doc.text(labelLines, margin + 4, yPosition + 6.5);

            // Valor
            doc.setFont('helvetica', 'bold');
            let displayValue = '';
            if (value === true) {
              displayValue = 'Yes';
              doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
            } else if (value === false) {
              displayValue = 'No';
              doc.setTextColor(150, 150, 150);
            } else {
              displayValue = String(value);
              if (input.unit) {
                displayValue += ` ${input.unit}`;
              }
              doc.setTextColor(darkColorR, darkColorG, darkColorB);
            }
            
            const valueWidth = doc.getTextWidth(displayValue);
            doc.text(displayValue, margin + contentWidth - valueWidth - 4, yPosition + 6.5);

            const rowHeight = Math.max(10, labelLines.length * 4 + 6);
            yPosition += rowHeight + 2; // Espacio entre filas
          }
        }

        yPosition += 5; // Espacio entre categorías
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
    
    // Countertops Files
    let countertopsFiles: string[] = [];
    if (kitchenInfo['countertopsFiles'] && Array.isArray(kitchenInfo['countertopsFiles']) && kitchenInfo['countertopsFiles'].length > 0) {
      countertopsFiles = kitchenInfo['countertopsFiles'] as string[];
    }
    
    // Backsplash Files
    let backsplashFiles: string[] = [];
    if (kitchenInfo['backsplashFiles'] && Array.isArray(kitchenInfo['backsplashFiles']) && kitchenInfo['backsplashFiles'].length > 0) {
      backsplashFiles = kitchenInfo['backsplashFiles'] as string[];
    }
    
    // Audio Notes (ahora es array)
    let audioNotesArray: { url: string; transcription?: string; summary?: string }[] = [];
    const audioNotesData = kitchenInfo['audioNotes'] || quote.audioNotes;
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
        
        console.log(`[PDF] Processing countertop file ${i + 1}:`, file);
        const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file);
        const isVideo = /\.(mp4|mov|mkv|avi|webm)$/i.test(file);
        
        if (isImage) {
          try {
            const label = countertopsFiles.length > 1 ? `Countertop ${i + 1} of ${countertopsFiles.length}` : 'Countertop';
            await renderFullWidthImage(file, label);
            yPosition += 4;
          } catch (error) {
            console.error('[PDF] Error rendering countertop image:', error);
          }
        } else {
          addPageIfNeeded(16);
          const label = fileNameFromUrl(file) || 'Countertop File';
          const mediaType = isVideo ? 'Video' : 'File';
          
          // Box con borde para el link
          doc.setFillColor(245, 245, 245);
          doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'S');
          
          // Texto y link
          doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          
          const typeLabel = `${mediaType}: `;
          const typeLabelWidth = doc.getTextWidth(typeLabel);
          doc.text(typeLabel, margin + 4, yPosition + 7.5);
          
          // Link clicable
          doc.setTextColor(0, 0, 255);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.textWithLink(label, margin + 4 + typeLabelWidth, yPosition + 7.5, { 
            url: file,
            color: [0, 0, 255]
          });
          
          // Mostrar también la URL completa debajo
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          const urlText = file.length > 80 ? file.substring(0, 80) + '...' : file;
          doc.text(urlText, margin + 4, yPosition + 10.5);
          
          yPosition += 16;
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
        
        console.log(`[PDF] Processing backsplash file ${i + 1}:`, file);
        const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file);
        const isVideo = /\.(mp4|mov|mkv|avi|webm)$/i.test(file);
        
        if (isImage) {
          try {
            const label = backsplashFiles.length > 1 ? `Backsplash ${i + 1} of ${backsplashFiles.length}` : 'Backsplash';
            await renderFullWidthImage(file, label);
            yPosition += 4;
          } catch (error) {
            console.error('[PDF] Error rendering backsplash image:', error);
          }
        } else {
          addPageIfNeeded(16);
          const label = fileNameFromUrl(file) || 'Backsplash File';
          const mediaType = isVideo ? 'Video' : 'File';
          
          // Box con borde para el link
          doc.setFillColor(245, 245, 245);
          doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'S');
          
          // Texto y link
          doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          
          const typeLabel = `${mediaType}: `;
          const typeLabelWidth = doc.getTextWidth(typeLabel);
          doc.text(typeLabel, margin + 4, yPosition + 7.5);
          
          // Link clicable
          doc.setTextColor(0, 0, 255);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.textWithLink(label, margin + 4 + typeLabelWidth, yPosition + 7.5, { 
            url: file,
            color: [0, 0, 255]
          });
          
          // Mostrar también la URL completa debajo
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          const urlText = file.length > 80 ? file.substring(0, 80) + '...' : file;
          doc.text(urlText, margin + 4, yPosition + 10.5);
          
          yPosition += 16;
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
          const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileUrl);

          if (isImage) {
            await renderFullWidthImage(fileUrl);
          } else {
            const label = fileNameFromUrl(fileUrl);
            addPageIfNeeded(16);
            const mediaType = 'File';
            
            // Box con borde para el link
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'S');
            
            // Texto y link
            doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            
            const typeLabel = `${mediaType}: `;
            const typeLabelWidth = doc.getTextWidth(typeLabel);
            doc.text(typeLabel, margin + 4, yPosition + 7.5);
            
            // Link clicable
            doc.setTextColor(0, 0, 255);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.textWithLink(label, margin + 4 + typeLabelWidth, yPosition + 7.5, { 
              url: fileUrl,
              color: [0, 0, 255]
            });
            
            // Mostrar también la URL completa debajo
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            const urlText = fileUrl.length > 80 ? fileUrl.substring(0, 80) + '...' : fileUrl;
            doc.text(urlText, margin + 4, yPosition + 10.5);
            
            yPosition += 16;
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

    // === SECCIÓN 4: Audio Notes ===
    if (audioNotesArray && audioNotesArray.length > 0) {
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

        const label = fileNameFromUrl(audioNote.url) || 'Audio File';
        
        // Box con borde para el audio
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'S');
        
        // Texto y link en la misma línea
        doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        
        const audioLabel = 'Audio: ';
        const audioLabelWidth = doc.getTextWidth(audioLabel);
        doc.text(audioLabel, margin + 4, yPosition + 7.5);
        
        // Link clicable
        doc.setTextColor(0, 0, 255);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.textWithLink(label, margin + 4 + audioLabelWidth, yPosition + 7.5, { 
          url: audioNote.url,
          color: [0, 0, 255]
        });
        
        // Mostrar también la URL completa debajo
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const urlText = audioNote.url.length > 80 ? audioNote.url.substring(0, 80) + '...' : audioNote.url;
        doc.text(urlText, margin + 4, yPosition + 10.5);
        
        yPosition += 16;
        
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

    // === SECCIÓN 6: Additional Comments & Media ===
    if (additionalCommentText || (additionalMedia && additionalMedia.length > 0)) {
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
          
          console.log('[PDF] Processing media:', media);
          const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(media);
          const isVideo = /\.(mp4|mov|mkv|avi|webm)$/i.test(media);
          console.log('[PDF] - isImage:', isImage, 'isVideo:', isVideo);
          
          if (isImage) {
            try {
              await renderFullWidthImage(media);
            } catch (error) {
              console.error('[PDF] Error rendering image:', error);
            }
          } else {
            addPageIfNeeded(16);
            const label = fileNameFromUrl(media) || 'Media File';
            const mediaType = isVideo ? 'Video' : 'File';
            
            // Box con borde para el link
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'S');
            
            // Texto y link
            doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            
            const typeLabel = `${mediaType}: `;
            const typeLabelWidth = doc.getTextWidth(typeLabel);
            doc.text(typeLabel, margin + 4, yPosition + 7.5);
            
            // Link clicable
            doc.setTextColor(0, 0, 255);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.textWithLink(label, margin + 4 + typeLabelWidth, yPosition + 7.5, { 
              url: media,
              color: [0, 0, 255]
            });
            
            // Mostrar también la URL completa debajo
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            const urlText = media.length > 80 ? media.substring(0, 80) + '...' : media;
            doc.text(urlText, margin + 4, yPosition + 10.5);
            
            yPosition += 16;
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

  private getImageFromUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('[PDF] Loading image from URL:', url);
      
      // Intentar primero con Image object (más compatible)
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          console.log('[PDF] Image loaded successfully, dimensions:', img.width, 'x', img.height);
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          console.log('[PDF] Image converted to data URL, length:', dataUrl.length);
          resolve(dataUrl);
        } catch (error) {
          console.error('[PDF] Error converting image to canvas:', error);
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        console.warn('[PDF] Image object failed, trying fetch:', error);
        // Fallback a fetch
        fetch(url, {
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-cache'
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          return new Promise<string>((resolveBlob, rejectBlob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              console.log('[PDF] Image loaded via fetch, data URL length:', result.length);
              resolveBlob(result);
            };
            reader.onerror = () => rejectBlob(new Error('FileReader error'));
            reader.readAsDataURL(blob);
          });
        })
        .then(dataUrl => {
          resolve(dataUrl);
        })
        .catch(fetchError => {
          console.error('[PDF] Both Image and fetch failed:', fetchError);
          reject(new Error(`Could not load image: ${fetchError.message}`));
        });
      };
      
      // Agregar timestamp para evitar caché y forzar recarga
      const separator = url.includes('?') ? '&' : '?';
      img.src = url + separator + '_t=' + new Date().getTime();
    });
  }
}

