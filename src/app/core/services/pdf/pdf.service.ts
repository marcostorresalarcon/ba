import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
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
    doc.save(fileName);
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
    const margin = 15;
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
    const infoBoxHeight = 35;
    const boxWidth = (contentWidth - 5) / 2;

    // Box Cliente - Diseño limpio sin fondo gris
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, yPosition, boxWidth, infoBoxHeight, 2, 2, 'S');
    
    // Título de sección con fondo verde sutil
    doc.setFillColor(primaryColorR, primaryColorG, primaryColorB);
    // Header del box
    doc.path([
      { op: 'm', c: [margin, yPosition + 8] }, // Inicio abajo izq del header
      { op: 'l', c: [margin, yPosition + 2] }, // Arriba izq (antes de curva)
      { op: 'c', c: [margin, yPosition, margin, yPosition, margin + 2, yPosition] }, // Curva esq sup izq
      { op: 'l', c: [margin + boxWidth - 2, yPosition] }, // Arriba der (antes de curva)
      { op: 'c', c: [margin + boxWidth, yPosition, margin + boxWidth, yPosition, margin + boxWidth, yPosition + 2] }, // Curva esq sup der
      { op: 'l', c: [margin + boxWidth, yPosition + 8] }, // Abajo der del header
      { op: 'l', c: [margin, yPosition + 8] } // Cerrar
    ], 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOMER INFORMATION', margin + 4, yPosition + 5);

    if (customer) {
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      // Name
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', margin + 4, yPosition + 14);
      doc.setFont('helvetica', 'normal');
      doc.text(customer.name, margin + 20, yPosition + 14);
      
      // Email
      if (customer.email) {
        doc.setFont('helvetica', 'bold');
        doc.text('Email:', margin + 4, yPosition + 20);
        doc.setFont('helvetica', 'normal');
        doc.text(customer.email, margin + 20, yPosition + 20);
      }
      
      // Phone
      if (customer.phone) {
        doc.setFont('helvetica', 'bold');
        doc.text('Phone:', margin + 4, yPosition + 26);
        doc.setFont('helvetica', 'normal');
        doc.text(customer.phone, margin + 20, yPosition + 26);
      }
    } else {
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('No customer information', margin + 4, yPosition + 14);
    }

    // Box Proyecto - Diseño limpio
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin + boxWidth + 5, yPosition, boxWidth, infoBoxHeight, 2, 2, 'S');
    
    // Header del box proyecto
    doc.setFillColor(darkColorR, darkColorG, darkColorB);
    const projX = margin + boxWidth + 5;
    doc.path([
      { op: 'm', c: [projX, yPosition + 8] },
      { op: 'l', c: [projX, yPosition + 2] },
      { op: 'c', c: [projX, yPosition, projX, yPosition, projX + 2, yPosition] },
      { op: 'l', c: [projX + boxWidth - 2, yPosition] },
      { op: 'c', c: [projX + boxWidth, yPosition, projX + boxWidth, yPosition, projX + boxWidth, yPosition + 2] },
      { op: 'l', c: [projX + boxWidth, yPosition + 8] },
      { op: 'l', c: [projX, yPosition + 8] }
    ], 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('PROJECT DETAILS', projX + 4, yPosition + 5);

    doc.setTextColor(darkColorR, darkColorG, darkColorB);
    doc.setFontSize(9);
    
    // Experience
    doc.setFont('helvetica', 'bold');
    doc.text('Experience:', projX + 4, yPosition + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.experience, projX + 25, yPosition + 14);
    
    // Status
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', projX + 4, yPosition + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.status.toUpperCase(), projX + 25, yPosition + 20);
    
    // Date
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', projX + 4, yPosition + 26);
    doc.setFont('helvetica', 'normal');
    doc.text(this.formatDate(quote.createdAt), projX + 25, yPosition + 26);

    yPosition += infoBoxHeight + 10;

    // Total Price destacado
    // Fondo con gradiente simulado (verde oscuro)
    doc.setFillColor(primaryColorR, primaryColorG, primaryColorB);
    doc.rect(margin, yPosition, contentWidth, 16, 'F'); // Rectángulo completo
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('TOTAL ESTIMATE', margin + 6, yPosition + 7);
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `$${(quote.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      margin + 6,
      yPosition + 14 // Alineado abajo
    );

    yPosition += 22; // Espacio aumentado

    // Notas si existen
    if (quote.notes) {
      const notesTitle = 'NOTES';
      const notesTitleWidth = doc.getTextWidth(notesTitle);
      
      // Línea superior decorativa
      doc.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition + 2, margin + contentWidth, yPosition + 2);
      
      doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(notesTitle, margin, yPosition);
      
      yPosition += 6;
      
      doc.setTextColor(darkColorR, darkColorG, darkColorB);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const notesLines = doc.splitTextToSize(quote.notes, contentWidth);
      doc.text(notesLines, margin, yPosition);
      
      // Altura dinámica basada en líneas
      const notesHeight = (notesLines.length * 4) + 8;
      yPosition += notesHeight;
    }

    // Información de Kitchen
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

          // Items de la subcategoría - Diseño limpio y minimalista
          
          for (const input of subcategoryGroup.inputs) {
            const value = quote.kitchenInformation?.[input.name];
            if (value === null || value === undefined || value === false || value === '' || value === 'No') {
              continue;
            }

            // Verificar si necesitamos nueva página
            if (yPosition > pageHeight - 15) {
              doc.addPage();
              yPosition = margin;
            }

            // Línea separadora muy sutil
            doc.setDrawColor(240, 240, 240);
            doc.setLineWidth(0.1);
            doc.line(margin, yPosition + 7, margin + contentWidth, yPosition + 7);

            // Label
            doc.setTextColor(100, 100, 100); // Gris oscuro para label
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            
            // Truncar label si es muy largo
            const labelWidth = contentWidth * 0.65;
            const labelLines = doc.splitTextToSize(input.label, labelWidth);
            doc.text(labelLines, margin + 2, yPosition + 5);

            // Valor
            doc.setFont('helvetica', 'bold');
            let displayValue = '';
            if (value === true) {
              displayValue = 'Yes';
              doc.setTextColor(primaryColorR, primaryColorG, primaryColorB);
            } else if (value === false) {
              displayValue = 'No';
            } else {
              displayValue = String(value);
              if (input.unit) {
                displayValue += ` ${input.unit}`;
              }
              doc.setTextColor(darkColorR, darkColorG, darkColorB);
            }
            
            // Alinear el valor a la derecha
            const valueWidth = doc.getTextWidth(displayValue);
            doc.text(displayValue, margin + contentWidth - valueWidth - 2, yPosition + 5);

            // Ajustar altura si el label ocupó varias líneas
            const rowHeight = Math.max(8, labelLines.length * 4 + 4);
            yPosition += rowHeight;
          }
        }

        yPosition += 5; // Espacio entre categorías
      }
    }

    // Materials Section
    if (quote.materials) {
      const materials = quote.materials as Materials;
      const hasMaterialsFile = !!materials.file;
      const hasMaterialsItems = !!(materials.items && materials.items.length > 0);

      if (hasMaterialsFile || hasMaterialsItems) {
        // Verificar si necesitamos nueva página
        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = margin;
        }

        // Título de sección Materials
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition + 8, margin + contentWidth, yPosition + 8);
        
        doc.setFillColor(primaryColorR, primaryColorG, primaryColorB);
        doc.path([
          { op: 'm', c: [margin, yPosition + 8] },
          { op: 'l', c: [margin, yPosition + 2] },
          { op: 'c', c: [margin, yPosition, margin, yPosition, margin + 2, yPosition] },
          { op: 'l', c: [margin + contentWidth/2, yPosition] },
          { op: 'l', c: [margin + contentWidth/2 + 5, yPosition + 8] },
          { op: 'l', c: [margin, yPosition + 8] }
        ], 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('MATERIALS LIST', margin + 6, yPosition + 6);
        yPosition += 14;

        // Materials File
        if (hasMaterialsFile && materials.file) {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = margin;
          }

          doc.setTextColor(darkColorR, darkColorG, darkColorB);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Materials File:', margin + 2, yPosition);
          yPosition += 6;

          // Intentar agregar imagen si es una URL de imagen
          const fileUrl = materials.file;
          const isImage = /\.(jpg|jpeg|png|webp)$/i.test(fileUrl);

          if (isImage) {
            try {
              const imgData = await this.getImageFromUrl(fileUrl);
              const imgProps = doc.getImageProperties(imgData);
              const imgRatio = imgProps.width / imgProps.height;
              
              // Calcular dimensiones ajustadas
              const maxWidth = contentWidth - 10;
              const maxHeight = 100; // Altura máxima permitida
              let imgWidth = maxWidth;
              let imgHeight = imgWidth / imgRatio;

              if (imgHeight > maxHeight) {
                imgHeight = maxHeight;
                imgWidth = imgHeight * imgRatio;
              }

              // Verificar espacio
              if (yPosition + imgHeight > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
              }

              doc.addImage(imgData, 'JPEG', margin + 5, yPosition, imgWidth, imgHeight);
              yPosition += imgHeight + 5;
            } catch (error) {
              console.error('Error adding image to PDF:', error);
              // Fallback a mostrar solo el link si falla la imagen
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9);
              doc.setTextColor(100, 100, 100);
              const fileName = fileUrl.split('/').pop() || fileUrl;
              const fileUrlLines = doc.splitTextToSize(fileName, contentWidth - 4);
              doc.text(fileUrlLines, margin + 4, yPosition);
              yPosition += (fileUrlLines.length * 4) + 8;
            }
          } else {
            // Si no es imagen, mostrar el link
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const fileName = fileUrl.split('/').pop() || fileUrl;
            const fileUrlLines = doc.splitTextToSize(fileName, contentWidth - 4);
            doc.text(fileUrlLines, margin + 4, yPosition);
            yPosition += (fileUrlLines.length * 4) + 8;
          }
        }

        // Materials Items
        if (hasMaterialsItems && materials.items) {
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = margin;
          }

          doc.setTextColor(darkColorR, darkColorG, darkColorB);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Materials Items:', margin + 2, yPosition);
          yPosition += 8;

          // Tabla de items
          const tableStartY = yPosition;
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

          // Items
          for (const item of materials.items) {
            if (yPosition > pageHeight - 20) {
              doc.addPage();
              yPosition = margin + 10;
            }

            // Línea separadora
            doc.setDrawColor(240, 240, 240);
            doc.setLineWidth(0.1);
            doc.line(margin + 2, yPosition - 2, margin + contentWidth - 2, yPosition - 2);

            // Quantity
            doc.setTextColor(darkColorR, darkColorG, darkColorB);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(String(item.quantity), margin + 4, yPosition);

            // Description
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            const descLines = doc.splitTextToSize(item.description, col2Width - 8);
            doc.text(descLines, margin + col1Width + 4, yPosition);

            const itemHeight = Math.max(rowHeight, descLines.length * 4 + 2);
            yPosition += itemHeight;
          }

          yPosition += 5;
        }
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
    doc.save(fileName);
  }

  private formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private getImageFromUrl(url: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous'; // Intentar evitar CORS
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        // Convertir a JPEG base64 y luego a Uint8Array
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64 = dataUrl.split(',')[1];
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        resolve(bytes);
      };
      
      img.onerror = (error) => {
        console.warn('Could not load image via Image object:', error);
        // Fallback a fetch si Image falla (aunque fetch probablemente falle también por CORS si Image falló)
        this.getImageFromUrlViaFetch(url).then(resolve).catch(reject);
      };
      
      // Agregar timestamp para evitar caché
      img.src = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    });
  }

  private async getImageFromUrlViaFetch(url: string): Promise<Uint8Array> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      return new Uint8Array(await blob.arrayBuffer());
    } catch (error) {
      throw error;
    }
  }
}

