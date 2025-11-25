import { Injectable } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import type { KitchenQuoteFormGroup } from '../../../features/quotes/ui/kitchen-quote-form/kitchen-quote-form.types';

@Injectable({
  providedIn: 'root'
})
export class CalculationService {
  /**
   * Helper para obtener el valor de un control de forma segura
   */
  private getControlValue<T = unknown>(form: KitchenQuoteFormGroup, controlName: string): T | null {
    const control = form.controls[controlName];
    if (!control) return null;
    return (control.value as T) ?? null;
  }

  /**
   * Helper para obtener el valor numérico de un control
   */
  private getNumericValue(form: KitchenQuoteFormGroup, controlName: string): number {
    const value = this.getControlValue<unknown>(form, controlName);
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Helper para obtener el valor booleano de un control
   * Retorna true si el valor es true (boolean) o 'yes' (string)
   */
  private getBooleanValue(form: KitchenQuoteFormGroup, controlName: string): boolean {
    const value = this.getControlValue<unknown>(form, controlName);
    return value === true || value === 'yes';
  }

  /**
   * Calcula el precio total del estimado basándose en todos los campos del formulario
   */
  calculateEstimateTotal(form: KitchenQuoteFormGroup, experience: string): number {
    let total = 0;

    // Location & Subfloor
    total += this.getLocationKitchenPrice(this.getControlValue<string[]>(form, 'locationKitchen'));
    total += this.getSubFloorPrice(this.getControlValue<string[]>(form, 'subFloor'));

    // Demolition
    total += this.getDemolitionPrice(this.getControlValue<string>(form, 'demolition'));
    total += this.getEliminateDrywallPrice(this.getControlValue<string>(form, 'eliminateDrywall'));
    if (this.getBooleanValue(form, 'dumpsterOnSite')) {
      total += 500; // Precio estimado para dumpster
    }

    // Wall Demo
    total += this.getWallDemoPrice(form);

    // Framing
    total += this.getFramingPrice(form);

    // Windows
    total += this.getWindowsPrice(form);

    // Painting
    total += this.getPaintingPrice(form);

    // Cabinets (basado en experience)
    total += this.getCabinetPrice(form, experience);

    // Countertops
    total += this.getCountertopPrice(form);
    total += this.getCountertopTemplateFeePrice(form);

    // Edging
    total += this.getEdgingPrice(form);

    // Cutouts
    total += this.getCutoutsPrice(form);

    // Sink Selection
    total += this.getSinkSelectionPrice(form);

    // Backsplash
    total += this.getBacksplashPrice(form);
    total += this.getStoneBacksplashTemplateFeePrice(form);

    // Appliance Installation
    total += this.getApplianceInstallationPrice(form);

    // Trim
    total += this.getTrimPrice(form);

    // Shelving
    total += this.getShelvingPrice(form);

    // Wood Hood Vent
    total += this.getWoodHoodVentPrice(form);

    // Ventilation Hood
    total += this.getVentilationHoodPrice(form);

    // Electrical
    total += this.getElectricalPrice(form);

    // Plumbing
    total += this.getPlumbingPrice(form);

    return Math.round(total * 100) / 100; // Redondear a 2 decimales
  }

  getLocationKitchenPrice(locationKitchen: string[] | null | undefined): number {
    // Asegurar que locationKitchen sea un array
    if (!locationKitchen) return 0;
    if (!Array.isArray(locationKitchen)) return 0;
    if (locationKitchen.length === 0) return 0;
    
    const prices: Record<string, number> = {
      mainFloor: 0,
      upstairs: 200,
      basement: 300
    };

    return locationKitchen.reduce((sum, loc) => sum + (prices[loc] ?? 0), 0);
  }

  getSubFloorPrice(subFloor: string[] | null | undefined): number {
    // Asegurar que subFloor sea un array
    if (!subFloor) return 0;
    if (!Array.isArray(subFloor)) return 0;
    if (subFloor.length === 0) return 0;
    
    const prices: Record<string, number> = {
      basementFinished: 150,
      basementUnfinished: 200,
      crawspace: 100
    };

    return subFloor.reduce((sum, floor) => sum + (prices[floor] ?? 0), 0);
  }

  getDemolitionPrice(demolition: string | null): number {
    if (!demolition) return 0;
    
    const prices: Record<string, number> = {
      kitchenSmall: 800,
      kitchenMedium: 1200,
      kitchenLarge: 1600
    };

    return prices[demolition] ?? 0;
  }

  getEliminateDrywallPrice(option: string | null): number {
    if (!option) return 0;
    
    const prices: Record<string, number> = {
      eliminateDrywallPantryLoadBearing: 500,
      eliminateDrywallPantryNonLoadBearing: 300
    };

    return prices[option] ?? 0;
  }

  getWallDemoPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const removeNonLoadWall = this.getNumericValue(form, 'removeNonLoadWall');
    const removeLVLWall = this.getNumericValue(form, 'removeLVLWall');
    const removeMetalWall = this.getNumericValue(form, 'removeMetalWall');
    const beamWrapCedar = this.getNumericValue(form, 'beamWrapCedar');

    total += removeNonLoadWall * 50; // $50 por LF
    total += removeLVLWall * 100; // $100 por LF
    total += removeMetalWall * 150; // $150 por LF
    total += beamWrapCedar * 75; // $75 por unidad

    if (this.getBooleanValue(form, 'recessedBeam')) total += 400;
    if (this.getBooleanValue(form, 'supportBasement')) total += 600;
    if (this.getBooleanValue(form, 'supportSlab')) total += 800;
    if (this.getBooleanValue(form, 'engineeringReport')) total += 500;
    if (this.getBooleanValue(form, 'demoElectricWiring')) total += 300;

    return total;
  }

  getFramingPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const buildNewWall = this.getNumericValue(form, 'buildNewWall');
    const relocateWallQuantity = this.getNumericValue(form, 'relocateWallQuantity');

    if (this.getBooleanValue(form, 'frameNewWall')) {
      total += buildNewWall * 60; // $60 por LF
    }

    if (this.getBooleanValue(form, 'relocateWall')) {
      total += relocateWallQuantity * 80; // $80 por unidad
    }

    return total;
  }

  getWindowsPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const doubleHungQty = this.getNumericValue(form, 'newWindowDoubleHungQuantity');
    const pictureWindowQty = this.getNumericValue(form, 'newWindowPictureWindowQuantity');
    const casementQty = this.getNumericValue(form, 'newWindowCasementQuantity');
    const removalQty = this.getNumericValue(form, 'windowRemovalQuantity');
    const relocateQty = this.getNumericValue(form, 'relocateWindowQuantity');

    if (this.getBooleanValue(form, 'newWindowDoubleHung')) {
      total += doubleHungQty * 400;
    }
    if (this.getBooleanValue(form, 'newWindowPictureWindow')) {
      total += pictureWindowQty * 600;
    }
    if (this.getBooleanValue(form, 'newWindowCasement')) {
      total += casementQty * 500;
    }
    if (this.getBooleanValue(form, 'windowRemoval')) {
      total += removalQty * 150;
    }
    if (this.getBooleanValue(form, 'relocateWindow')) {
      total += relocateQty * 300;
    }

    return total;
  }

  getPaintingPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const primeQty = this.getNumericValue(form, 'paintPrimeCeilingWallsQuantity');
    const ceilingWallsQty = this.getNumericValue(form, 'paintCeilingWallsQuantity');
    const trimQty = this.getNumericValue(form, 'paintTrimCrownBaseCasingQuantity');
    const windowQty = this.getNumericValue(form, 'paintWindowQuantity');
    const doorQty = this.getNumericValue(form, 'paintDoorQuantity');
    const exteriorDoorQty = this.getNumericValue(form, 'paintExteriorDoorQuantity');
    const exteriorDoorStainQty = this.getNumericValue(form, 'paintExteriorDoorStainSealQuantity');

    if (this.getBooleanValue(form, 'paintPrimeCeilingWalls')) {
      total += primeQty * 2.5; // $2.5 por SF
    }
    if (this.getBooleanValue(form, 'paintCeilingWalls')) {
      total += ceilingWallsQty * 3.5; // $3.5 por SF
    }
    if (this.getBooleanValue(form, 'paintTrimCrownBaseCasing')) {
      total += trimQty * 4.5; // $4.5 por LF
    }
    if (this.getBooleanValue(form, 'paintWindow')) {
      total += windowQty * 150; // $150 por ventana
    }
    if (this.getBooleanValue(form, 'paintDoor')) {
      total += doorQty * 200; // $200 por puerta
    }
    if (this.getBooleanValue(form, 'paintExteriorDoor')) {
      total += exteriorDoorQty * 300; // $300 por puerta exterior
    }
    if (this.getBooleanValue(form, 'paintExteriorDoorStainSeal')) {
      total += exteriorDoorStainQty * 350; // $350 por puerta
    }

    return total;
  }

  getCabinetPrice(form: KitchenQuoteFormGroup, experience: string): number {
    let total = 0;
    
    if (experience === 'basic') {
      const qty36 = this.getNumericValue(form, 'basic36UpperCabinetsQuantity');
      const qty42 = this.getNumericValue(form, 'basic42UpperCabinetsQuantity');
      const baseQty = this.getNumericValue(form, 'basicBaseCabinetQuantity');
      const tallQty = this.getNumericValue(form, 'basicTallCabinetsQuantity');

      if (this.getBooleanValue(form, 'basic36UpperCabinets')) total += qty36 * 250;
      if (this.getBooleanValue(form, 'basic42UpperCabinets')) total += qty42 * 280;
      if (this.getBooleanValue(form, 'basicBaseCabinet')) total += baseQty * 300;
      if (this.getBooleanValue(form, 'basicTallCabinets')) total += tallQty * 400;
    } else if (experience === 'premium') {
      const qty30 = this.getNumericValue(form, 'premium30UpperCabinetQuantity');
      const qty36 = this.getNumericValue(form, 'premium36UpperCabinetsQuantity');
      const qty42 = this.getNumericValue(form, 'premium42UpperCabinetsQuantity');
      const baseQty = this.getNumericValue(form, 'premiumBaseCabinetQuantity');
      const tallQty = this.getNumericValue(form, 'premiumTallCabinetsQuantity');

      if (this.getBooleanValue(form, 'premium30UpperCabinet')) total += qty30 * 350;
      if (this.getBooleanValue(form, 'premium36UpperCabinets')) total += qty36 * 400;
      if (this.getBooleanValue(form, 'premium42UpperCabinets')) total += qty42 * 450;
      if (this.getBooleanValue(form, 'premiumBaseCabinet')) total += baseQty * 500;
      if (this.getBooleanValue(form, 'premiumTallCabinets')) total += tallQty * 600;
    } else if (experience === 'luxury') {
      const qty30 = this.getNumericValue(form, 'luxury30UpperCabinetQuantity');
      const qty36 = this.getNumericValue(form, 'luxury36UpperCabinetsQuantity');
      const qty42 = this.getNumericValue(form, 'luxury42UpperCabinetsQuantity');
      const baseQty = this.getNumericValue(form, 'luxuryBaseCabinetQuantity');
      const tallQty = this.getNumericValue(form, 'luxuryTallCabinetsQuantity');

      if (this.getBooleanValue(form, 'luxury30UpperCabinet')) total += qty30 * 500;
      if (this.getBooleanValue(form, 'luxury36UpperCabinets')) total += qty36 * 600;
      if (this.getBooleanValue(form, 'luxury42UpperCabinets')) total += qty42 * 700;
      if (this.getBooleanValue(form, 'luxuryBaseCabinet')) total += baseQty * 800;
      if (this.getBooleanValue(form, 'luxuryTallCabinets')) total += tallQty * 1000;
    }

    // Stackers
    const stackersWithGlass12Qty = this.getNumericValue(form, 'stackersWithGlass12Quantity');
    const stackersWithGlass15Qty = this.getNumericValue(form, 'stackersWithGlass15Quantity');
    const stackersWithGlass18Qty = this.getNumericValue(form, 'stackersWithGlass18Quantity');
    const stackersWithoutGlass12Qty = this.getNumericValue(form, 'stackersWithoutGlass12Quantity');
    const stackersWithoutGlass15Qty = this.getNumericValue(form, 'stackersWithoutGlass15Quantity');
    const stackersWithoutGlass18Qty = this.getNumericValue(form, 'stackersWithoutGlass18Quantity');

    if (this.getBooleanValue(form, 'stackersWithGlass12')) total += stackersWithGlass12Qty * 150;
    if (this.getBooleanValue(form, 'stackersWithGlass15')) total += stackersWithGlass15Qty * 180;
    if (this.getBooleanValue(form, 'stackersWithGlass18')) total += stackersWithGlass18Qty * 200;
    if (this.getBooleanValue(form, 'stackersWithoutGlass12')) total += stackersWithoutGlass12Qty * 100;
    if (this.getBooleanValue(form, 'stackersWithoutGlass15')) total += stackersWithoutGlass15Qty * 120;
    if (this.getBooleanValue(form, 'stackersWithoutGlass18')) total += stackersWithoutGlass18Qty * 140;

    // Wide Pocket Doors
    if (this.getBooleanValue(form, 'widePocketDoors')) {
      const qty = this.getNumericValue(form, 'widePocketDoorsQuantity');
      total += qty * 400;
    }

    // Glass Doors
    const glassDoors = this.getNumericValue(form, 'glassDoors');
    total += glassDoors * 200;

    return total;
  }

  getCountertopPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const quartzQty = this.getNumericValue(form, 'countertopsQuartzQuantity');
    const quartziteQty = this.getNumericValue(form, 'countertopsQuartziteQuantity');
    const graniteQty = this.getNumericValue(form, 'countertopsGraniteQuantity');
    const marbleQty = this.getNumericValue(form, 'countertopsMarbleQuantity');

    if (this.getBooleanValue(form, 'countertopsQuartz')) {
      total += quartzQty * 60; // $60 por SF
    }
    if (this.getBooleanValue(form, 'countertopsQuartzite')) {
      total += quartziteQty * 80; // $80 por SF
    }
    if (this.getBooleanValue(form, 'countertopsGranite')) {
      total += graniteQty * 70; // $70 por SF
    }
    if (this.getBooleanValue(form, 'countertopsMarble')) {
      total += marbleQty * 100; // $100 por SF
    }

    return total;
  }

  getCountertopTemplateFeePrice(form: KitchenQuoteFormGroup): number {
    if (this.getBooleanValue(form, 'countertopTemplateFeeSmall')) return 200;
    if (this.getBooleanValue(form, 'countertopTemplateFeeMedium')) return 300;
    if (this.getBooleanValue(form, 'countertopTemplateFeeLarge')) return 400;
    return 0;
  }

  getEdgingPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const easedQty = this.getNumericValue(form, 'edgingEasedPolishedQuantity');
    const bevelQty = this.getNumericValue(form, 'edgingBevelQuantity');
    const bullnoseQty = this.getNumericValue(form, 'edgingBullnoseQuantity');
    const halfBullnoseQty = this.getNumericValue(form, 'edgingHalfBullnoseQuantity');
    const ogeeQty = this.getNumericValue(form, 'edgingOgeeQuantity');
    const miteredQty = this.getNumericValue(form, 'edgingMiteredEdgeQuantity');

    if (this.getBooleanValue(form, 'edgingEasedPolished')) total += easedQty * 15;
    if (this.getBooleanValue(form, 'edgingBevel')) total += bevelQty * 20;
    if (this.getBooleanValue(form, 'edgingBullnose')) total += bullnoseQty * 25;
    if (this.getBooleanValue(form, 'edgingHalfBullnose')) total += halfBullnoseQty * 22;
    if (this.getBooleanValue(form, 'edgingOgee')) total += ogeeQty * 30;
    if (this.getBooleanValue(form, 'edgingMiteredEdge')) total += miteredQty * 35;

    return total;
  }

  getCutoutsPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    if (this.getBooleanValue(form, 'cutoutsSinkFaucet')) total += 150;
    if (this.getBooleanValue(form, 'cutoutsCooktop')) total += 200;
    const additional = this.getNumericValue(form, 'cutoutsAdditional');
    total += additional * 100;

    return total;
  }

  getSinkSelectionPrice(form: KitchenQuoteFormGroup): number {
    const sinkValue = this.getControlValue<unknown>(form, 'sinkSelection');
    
    // Si sinkSelection es un string (viene del backend), convertirlo a array
    let sinks: string[] = [];
    if (typeof sinkValue === 'string') {
      sinks = sinkValue.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    } else if (Array.isArray(sinkValue)) {
      sinks = sinkValue as string[];
    }
    
    if (sinks.length === 0) return 0;
    
    const prices: Record<string, number> = {
      'single-bowl': 300,
      'double-bowl': 500,
      'farmhouse': 600,
      'undermount': 400
    };

    return sinks.reduce((sum, sink) => sum + (prices[sink] ?? 200), 0);
  }

  getBacksplashPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const tileQty = this.getNumericValue(form, 'backsplashTileQuantity');
    const quartzQty = this.getNumericValue(form, 'backsplashQuartzQuantity');
    const quartziteQty = this.getNumericValue(form, 'backsplashQuartziteQuantity');
    const graniteQty = this.getNumericValue(form, 'backsplashGraniteQuantity');
    const marbleQty = this.getNumericValue(form, 'backsplashMarbleQuantity');

    if (this.getBooleanValue(form, 'backsplashPrep')) total += 200;
    if (this.getBooleanValue(form, 'backsplashTile')) total += tileQty * 25;
    if (this.getBooleanValue(form, 'backsplashQuartz')) total += quartzQty * 50;
    if (this.getBooleanValue(form, 'backsplashQuartzite')) total += quartziteQty * 60;
    if (this.getBooleanValue(form, 'backsplashGranite')) total += graniteQty * 55;
    if (this.getBooleanValue(form, 'backsplashMarble')) total += marbleQty * 70;

    return total;
  }

  getStoneBacksplashTemplateFeePrice(form: KitchenQuoteFormGroup): number {
    if (this.getBooleanValue(form, 'stoneBacksplashTemplateFeeSmall')) return 150;
    if (this.getBooleanValue(form, 'stoneBacksplashTemplateFeeMedium')) return 250;
    if (this.getBooleanValue(form, 'stoneBacksplashTemplateFeeLarge')) return 350;
    return 0;
  }

  getApplianceInstallationPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    if (this.getBooleanValue(form, 'applianceCooktop')) total += 200;
    if (this.getBooleanValue(form, 'applianceDoubleOven')) total += 300;
    if (this.getBooleanValue(form, 'applianceHoodInsert')) total += 150;
    if (this.getBooleanValue(form, 'applianceBeverageFridge')) total += 250;
    if (this.getBooleanValue(form, 'applianceIceMaker')) total += 300;
    if (this.getBooleanValue(form, 'applianceWashDryer')) total += 400;
    if (this.getBooleanValue(form, 'applianceDishwasher')) total += 200;
    if (this.getBooleanValue(form, 'applianceDisposal')) total += 150;

    const range30Qty = this.getNumericValue(form, 'applianceFreestandingRange30Quantity');
    const range36Qty = this.getNumericValue(form, 'applianceFreestandingRange36Quantity');
    const range48Qty = this.getNumericValue(form, 'applianceFreestandingRange48Quantity');
    const fridge36Qty = this.getNumericValue(form, 'applianceFridge36Quantity');
    const fridge42Qty = this.getNumericValue(form, 'applianceFridge42Quantity');

    if (this.getBooleanValue(form, 'applianceFreestandingRange30')) total += range30Qty * 250;
    if (this.getBooleanValue(form, 'applianceFreestandingRange36')) total += range36Qty * 300;
    if (this.getBooleanValue(form, 'applianceFreestandingRange48')) total += range48Qty * 350;
    if (this.getBooleanValue(form, 'applianceFridge36')) total += fridge36Qty * 400;
    if (this.getBooleanValue(form, 'applianceFridge42')) total += fridge42Qty * 500;

    return total;
  }

  getTrimPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const quarterRound = this.getNumericValue(form, 'trimQuarterRound');
    total += quarterRound * 3; // $3 por LF

    // Baseboards
    const base35Qty = this.getNumericValue(form, 'trimBaseboards35Quantity');
    const base525Qty = this.getNumericValue(form, 'trimBaseboards525Quantity');
    const base725Qty = this.getNumericValue(form, 'trimBaseboards725Quantity');

    if (this.getBooleanValue(form, 'trimBaseboards35')) total += base35Qty * 4;
    if (this.getBooleanValue(form, 'trimBaseboards525')) total += base525Qty * 5;
    if (this.getBooleanValue(form, 'trimBaseboards725')) total += base725Qty * 6;

    // Crown
    const crown4Qty = this.getNumericValue(form, 'trimCrown4Quantity');
    const crown6Qty = this.getNumericValue(form, 'trimCrown6Quantity');
    const crown8Qty = this.getNumericValue(form, 'trimCrown8Quantity');

    if (this.getBooleanValue(form, 'trimCrown4')) total += crown4Qty * 5;
    if (this.getBooleanValue(form, 'trimCrown6')) total += crown6Qty * 6;
    if (this.getBooleanValue(form, 'trimCrown8')) total += crown8Qty * 7;

    // Door Casing
    const casing225Qty = this.getNumericValue(form, 'trimDoorCasing225Quantity');
    const casing35Qty = this.getNumericValue(form, 'trimDoorCasing35Quantity');

    if (this.getBooleanValue(form, 'trimDoorCasing225')) total += casing225Qty * 4;
    if (this.getBooleanValue(form, 'trimDoorCasing35')) total += casing35Qty * 5;

    return total;
  }

  getShelvingPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const glassHalf = this.getNumericValue(form, 'glassShelvesHalf');
    const floatingMatch = this.getNumericValue(form, 'floatingShelvesMatch');
    const floatingCustom = this.getNumericValue(form, 'floatingShelvesCustom');

    total += glassHalf * 50;
    total += floatingMatch * 75;
    total += floatingCustom * 100;

    return total;
  }

  getWoodHoodVentPrice(form: KitchenQuoteFormGroup): number {
    const size = this.getControlValue<string>(form, 'woodHoodVentSize');
    if (!size) return 0;
    
    const prices: Record<string, number> = {
      '30': 400,
      '36': 500,
      '48': 600,
      '60': 700
    };

    return prices[size] ?? 0;
  }

  getVentilationHoodPrice(_form: KitchenQuoteFormGroup): number {
    // TODO: Implementar cuando se agreguen los campos de ventilación
    return 0;
  }

  getElectricalPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    const canLightQty = this.getNumericValue(form, 'canLightQuantity');
    const pendantLights = this.getNumericValue(form, 'pendantLights');
    const addBreaker = this.getNumericValue(form, 'addBreaker');

    const canLightSize = this.getControlValue<string>(form, 'canLightSize');
    if (canLightSize === '4' || canLightSize === '6') {
      total += canLightQty * 150;
    }
    total += pendantLights * 200;
    total += addBreaker * 300;

    // Relocate Power
    const relocateRange220 = this.getNumericValue(form, 'relocateRange220');
    const relocateCooktop220 = this.getNumericValue(form, 'relocateCooktop220');
    const relocateDoubleOven220 = this.getNumericValue(form, 'relocateDoubleOven220');
    const relocateRange120 = this.getNumericValue(form, 'relocateRange120');
    const relocateCooktop120 = this.getNumericValue(form, 'relocateCooktop120');
    const relocateFridge120 = this.getNumericValue(form, 'relocateFridge120');
    const relocateHood120 = this.getNumericValue(form, 'relocateHoodInsert120');
    const relocateMicrowave120 = this.getNumericValue(form, 'relocateMicrowave120');
    const relocateIsland120 = this.getNumericValue(form, 'relocateIsland120');

    total += relocateRange220 * 400;
    total += relocateCooktop220 * 350;
    total += relocateDoubleOven220 * 450;
    total += relocateRange120 * 200;
    total += relocateCooktop120 * 180;
    total += relocateFridge120 * 150;
    total += relocateHood120 * 120;
    total += relocateMicrowave120 * 100;
    total += relocateIsland120 * 250;

    // Run Power
    const runRange220 = this.getNumericValue(form, 'runPowerRange220');
    const runCooktop220 = this.getNumericValue(form, 'runPowerCooktop220');
    const runDoubleOven220 = this.getNumericValue(form, 'runPowerDoubleOven220');
    const runRange120 = this.getNumericValue(form, 'runPowerRange120');
    const runCooktop120 = this.getNumericValue(form, 'runPowerCooktop120');
    const runHood120 = this.getNumericValue(form, 'runPowerHoodInsert120');
    const runMicrowave120 = this.getNumericValue(form, 'runPowerMicrowave120');
    const runIsland110 = this.getNumericValue(form, 'runPowerIsland110');

    total += runRange220 * 500;
    total += runCooktop220 * 450;
    total += runDoubleOven220 * 550;
    total += runRange120 * 300;
    total += runCooktop120 * 280;
    total += runHood120 * 200;
    total += runMicrowave120 * 180;
    total += runIsland110 * 350;

    // Outlets
    const addingOutletsExisting = this.getNumericValue(form, 'addingOutletsExisting');
    const addingOutletsRunPower = this.getNumericValue(form, 'addingOutletsRunPower');

    total += addingOutletsExisting * 150;
    total += addingOutletsRunPower * 250;

    // Switches
    const reuseSwitchQty = this.getNumericValue(form, 'reuseSwitchQuantity');
    const addNewSwitchQty = this.getNumericValue(form, 'addNewSwitchQuantity');
    const addNewDimmerQty = this.getNumericValue(form, 'addNewDimmerQuantity');

    if (this.getBooleanValue(form, 'reuseSwitch')) total += reuseSwitchQty * 50;
    if (this.getBooleanValue(form, 'addNewSwitch')) total += addNewSwitchQty * 100;
    if (this.getBooleanValue(form, 'addNewDimmer')) total += addNewDimmerQty * 120;

    // Panels
    if (this.getBooleanValue(form, 'addSubpanel50')) total += 800;
    if (this.getBooleanValue(form, 'addSubpanel100')) total += 1200;
    if (this.getBooleanValue(form, 'upgradePanel')) total += 1000;
    if (this.getBooleanValue(form, 'relocateSwitchesOutlets')) total += 300;

    // Dishwasher Wiring
    const dishwasherWiringQty = this.getNumericValue(form, 'dishwasherWiringQuantity');
    if (this.getBooleanValue(form, 'dishwasherWiring')) total += dishwasherWiringQty * 150;
    if (this.getBooleanValue(form, 'disposalWiring')) total += 100;

    // Plug Molds, LED Lighting, Puck Lights
    if (this.getBooleanValue(form, 'plugMoldSmall')) total += 200;
    if (this.getBooleanValue(form, 'plugMoldMedium')) total += 300;
    if (this.getBooleanValue(form, 'plugMoldLarge')) total += 400;
    if (this.getBooleanValue(form, 'ledLightingSmall')) total += 250;
    if (this.getBooleanValue(form, 'ledLightingMedium')) total += 350;
    if (this.getBooleanValue(form, 'ledLightingLarge')) total += 450;
    if (this.getBooleanValue(form, 'puckLightsSmall')) total += 180;
    if (this.getBooleanValue(form, 'puckLightsMedium')) total += 280;
    if (this.getBooleanValue(form, 'puckLightsLarge')) total += 380;

    if (this.getBooleanValue(form, 'installAirSwitch')) total += 150;
    if (this.getBooleanValue(form, 'keepSwitchOnWall')) total += 50;

    return total;
  }

  getPlumbingPrice(form: KitchenQuoteFormGroup): number {
    let total = 0;
    
    if (this.getBooleanValue(form, 'runNewDrainSupply')) total += 400;
    
    const relocateSink = this.getNumericValue(form, 'relocateSinkPlumbing');
    const relocateFridge = this.getNumericValue(form, 'relocateFridgeWaterLine');
    const installNewWaterLineDishwasher = this.getNumericValue(form, 'installNewWaterLineDishwasher');
    const runNewGasLine = this.getNumericValue(form, 'runNewGasLine');
    const relocateGasLine = this.getNumericValue(form, 'relocateGasLine');

    total += relocateSink * 300;
    if (this.getBooleanValue(form, 'installNewFridgeWaterBox')) total += 200;
    total += relocateFridge * 150;
    if (this.getBooleanValue(form, 'relocateDishwasher')) total += 250;
    total += installNewWaterLineDishwasher * 200;
    total += runNewGasLine * 500;
    total += relocateGasLine * 400;
    if (this.getBooleanValue(form, 'reworkSinkPlumbing')) total += 300;
    if (this.getBooleanValue(form, 'runWaterlinePotFiller')) total += 350;

    const installFaucetQty = this.getNumericValue(form, 'installFaucetQuantity');
    const concreteCutPatchQty = this.getNumericValue(form, 'concreteCutPatchQuantity');
    const installInsulationQty = this.getNumericValue(form, 'installNewInsulationR13Quantity');

    if (this.getBooleanValue(form, 'installFaucet')) total += installFaucetQty * 200;
    if (this.getBooleanValue(form, 'concreteCutPatch')) total += concreteCutPatchQty * 150;
    if (this.getBooleanValue(form, 'installNewInsulationR13')) total += installInsulationQty * 2.5; // $2.5 por SF

    return total;
  }
}
