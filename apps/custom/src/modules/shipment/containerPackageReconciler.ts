import { db } from "@/lib/db";
import { Prisma, ShipmentContainer, ShipmentPackage } from "@prisma/client";
import { FactService, FactSourceType, RecordFactInput } from "./factService";

export interface ContainerDiscovery {
  containerNumber: string;
  sealNumbers?: string[] | null;
  containerType?: string | null;
  containerSize?: string | null;
  containerHeight?: string | null;
  packageCount?: number | null;
  packageType?: string | null;
  descriptionOfGoods?: string | null;
  pieceQuantity?: number | null;
  quantityUom?: string | null;
  grossWeight?: number | null;
  netWeight?: number | null;
  weightUom?: string | null;
  volume?: number | null;
  volumeUom?: string | null;
  marksAndNumbers?: string | null;
}

export interface PackageDiscovery {
  packageNumber: string;
  containerNumber?: string | null;
  packageType?: string | null;
  cartonNumber?: string | null;
  packageCount?: number | null;
  marksAndNumbers?: string | null;
  grossWeight?: number | null;
  netWeight?: number | null;
  weightUom?: string | null;
  dimensions?: string | null;
  volume?: number | null;
  volumeUom?: string | null;
  containedItems?: string[] | null;
}

export interface ApplyContainerDiscoveriesInput {
  shipmentId: string;
  accountId: string;
  documentId?: string | null;
  sourceType: Extract<FactSourceType, "EXTRACTED" | "AGENT_PROPOSED">;
  items: ContainerDiscovery[];
}

export interface ApplyPackageDiscoveriesInput {
  shipmentId: string;
  accountId: string;
  documentId?: string | null;
  sourceType: Extract<FactSourceType, "EXTRACTED" | "AGENT_PROPOSED">;
  items: PackageDiscovery[];
}

/** Same write-authority boundary as LineItemReconciler: every discovery is recorded to
 * Fact unconditionally; a curated row is only ever filled where currently empty, and is
 * fully locked once a human sets status to "Valid". See lineItemReconciler.ts for the
 * pattern this mirrors. */
export class ContainerReconciler {
  static async applyDiscoveries(input: ApplyContainerDiscoveriesInput, tx?: any): Promise<void> {
    for (const item of input.items) {
      await this.applyOne(input, item, tx);
    }
  }

  private static async recordFacts(ctx: ApplyContainerDiscoveriesInput, item: ContainerDiscovery, tx?: any): Promise<void> {
    const facts: RecordFactInput[] = [];
    const entityRef = `container:${item.containerNumber}`;
    const push = (field: string, value: string | number | null | undefined) => {
      if (value === null || value === undefined || value === "") return;
      facts.push({
        shipmentId: ctx.shipmentId,
        field: `container.${item.containerNumber}.${field}`,
        value: String(value),
        sourceType: ctx.sourceType,
        documentId: ctx.documentId ?? null,
        entityRef,
      });
    };
    push("sealNumbers", item.sealNumbers?.length ? item.sealNumbers.join(",") : null);
    push("containerType", item.containerType);
    push("containerSize", item.containerSize);
    push("containerHeight", item.containerHeight);
    push("packageCount", item.packageCount);
    push("packageType", item.packageType);
    push("descriptionOfGoods", item.descriptionOfGoods);
    push("pieceQuantity", item.pieceQuantity);
    push("quantityUom", item.quantityUom);
    push("grossWeight", item.grossWeight);
    push("netWeight", item.netWeight);
    push("weightUom", item.weightUom);
    push("volume", item.volume);
    push("volumeUom", item.volumeUom);
    push("marksAndNumbers", item.marksAndNumbers);
    await FactService.recordMany(facts, tx);
  }

  private static async applyOne(ctx: ApplyContainerDiscoveriesInput, item: ContainerDiscovery, tx?: any): Promise<void> {
    const client = tx || db;
    await this.recordFacts(ctx, item, tx);

    const existing = await client.shipmentContainer.findFirst({
      where: { shipmentId: ctx.shipmentId, accountId: ctx.accountId, containerNumber: item.containerNumber },
    });

    if (!existing) {
      await this.create(ctx, item, tx);
      return;
    }
    await this.fillEmpty(existing, item, tx);
  }

  private static async create(ctx: ApplyContainerDiscoveriesInput, item: ContainerDiscovery, tx?: any): Promise<void> {
    const client = tx || db;
    await client.shipmentContainer.create({
      data: {
        shipmentId: ctx.shipmentId,
        accountId: ctx.accountId,
        containerNumber: item.containerNumber,
        sealNumbers: item.sealNumbers ?? [],
        containerType: item.containerType ?? null,
        containerSize: item.containerSize ?? null,
        containerHeight: item.containerHeight ?? null,
        packageCount: item.packageCount ?? null,
        packageType: item.packageType ?? null,
        descriptionOfGoods: item.descriptionOfGoods ?? null,
        pieceQuantity: item.pieceQuantity ?? null,
        quantityUom: item.quantityUom ?? null,
        grossWeight: item.grossWeight != null ? new Prisma.Decimal(item.grossWeight) : null,
        netWeight: item.netWeight != null ? new Prisma.Decimal(item.netWeight) : null,
        weightUom: item.weightUom ?? null,
        volume: item.volume != null ? new Prisma.Decimal(item.volume) : null,
        volumeUom: item.volumeUom ?? null,
        marksAndNumbers: item.marksAndNumbers ?? null,
      },
    });
  }

  private static async fillEmpty(existing: ShipmentContainer, item: ContainerDiscovery, tx?: any): Promise<void> {
    const client = tx || db;
    if (existing.status === "Valid") return;

    const data: Prisma.ShipmentContainerUpdateInput = {};
    if (existing.sealNumbers.length === 0 && item.sealNumbers?.length) data.sealNumbers = item.sealNumbers;
    if (existing.containerType == null && item.containerType) data.containerType = item.containerType;
    if (existing.containerSize == null && item.containerSize) data.containerSize = item.containerSize;
    if (existing.containerHeight == null && item.containerHeight) data.containerHeight = item.containerHeight;
    if (existing.packageCount == null && item.packageCount != null) data.packageCount = item.packageCount;
    if (existing.packageType == null && item.packageType) data.packageType = item.packageType;
    if (existing.descriptionOfGoods == null && item.descriptionOfGoods) data.descriptionOfGoods = item.descriptionOfGoods;
    if (existing.pieceQuantity == null && item.pieceQuantity != null) data.pieceQuantity = item.pieceQuantity;
    if (existing.quantityUom == null && item.quantityUom) data.quantityUom = item.quantityUom;
    if (existing.grossWeight == null && item.grossWeight != null) data.grossWeight = new Prisma.Decimal(item.grossWeight);
    if (existing.netWeight == null && item.netWeight != null) data.netWeight = new Prisma.Decimal(item.netWeight);
    if (existing.weightUom == null && item.weightUom) data.weightUom = item.weightUom;
    if (existing.volume == null && item.volume != null) data.volume = new Prisma.Decimal(item.volume);
    if (existing.volumeUom == null && item.volumeUom) data.volumeUom = item.volumeUom;
    if (existing.marksAndNumbers == null && item.marksAndNumbers) data.marksAndNumbers = item.marksAndNumbers;

    if (Object.keys(data).length === 0) return;
    await client.shipmentContainer.update({ where: { id: existing.id }, data });
  }
}

export class PackageReconciler {
  static async applyDiscoveries(input: ApplyPackageDiscoveriesInput, tx?: any): Promise<void> {
    for (const item of input.items) {
      await this.applyOne(input, item, tx);
    }
  }

  private static async recordFacts(ctx: ApplyPackageDiscoveriesInput, item: PackageDiscovery, tx?: any): Promise<void> {
    const facts: RecordFactInput[] = [];
    const entityRef = `package:${item.packageNumber}`;
    const push = (field: string, value: string | number | null | undefined) => {
      if (value === null || value === undefined || value === "") return;
      facts.push({
        shipmentId: ctx.shipmentId,
        field: `package.${item.packageNumber}.${field}`,
        value: String(value),
        sourceType: ctx.sourceType,
        documentId: ctx.documentId ?? null,
        entityRef,
      });
    };
    push("containerNumber", item.containerNumber);
    push("packageType", item.packageType);
    push("cartonNumber", item.cartonNumber);
    push("packageCount", item.packageCount);
    push("marksAndNumbers", item.marksAndNumbers);
    push("grossWeight", item.grossWeight);
    push("netWeight", item.netWeight);
    push("weightUom", item.weightUom);
    push("dimensions", item.dimensions);
    push("volume", item.volume);
    push("volumeUom", item.volumeUom);
    push("containedItems", item.containedItems?.length ? item.containedItems.join(",") : null);
    await FactService.recordMany(facts, tx);
  }

  private static async applyOne(ctx: ApplyPackageDiscoveriesInput, item: PackageDiscovery, tx?: any): Promise<void> {
    const client = tx || db;
    await this.recordFacts(ctx, item, tx);

    const existing = await client.shipmentPackage.findFirst({
      where: { shipmentId: ctx.shipmentId, accountId: ctx.accountId, packageNumber: item.packageNumber },
    });

    if (!existing) {
      await this.create(ctx, item, tx);
      return;
    }
    await this.fillEmpty(existing, item, tx);
  }

  private static async create(ctx: ApplyPackageDiscoveriesInput, item: PackageDiscovery, tx?: any): Promise<void> {
    const client = tx || db;
    await client.shipmentPackage.create({
      data: {
        shipmentId: ctx.shipmentId,
        accountId: ctx.accountId,
        packageNumber: item.packageNumber,
        containerNumber: item.containerNumber ?? null,
        packageType: item.packageType ?? null,
        cartonNumber: item.cartonNumber ?? null,
        packageCount: item.packageCount ?? null,
        marksAndNumbers: item.marksAndNumbers ?? null,
        grossWeight: item.grossWeight != null ? new Prisma.Decimal(item.grossWeight) : null,
        netWeight: item.netWeight != null ? new Prisma.Decimal(item.netWeight) : null,
        weightUom: item.weightUom ?? null,
        dimensions: item.dimensions ?? null,
        volume: item.volume != null ? new Prisma.Decimal(item.volume) : null,
        volumeUom: item.volumeUom ?? null,
        containedItems: item.containedItems ?? [],
      },
    });
  }

  private static async fillEmpty(existing: ShipmentPackage, item: PackageDiscovery, tx?: any): Promise<void> {
    const client = tx || db;
    if (existing.status === "Valid") return;

    const data: Prisma.ShipmentPackageUpdateInput = {};
    if (existing.containerNumber == null && item.containerNumber) data.containerNumber = item.containerNumber;
    if (existing.packageType == null && item.packageType) data.packageType = item.packageType;
    if (existing.cartonNumber == null && item.cartonNumber) data.cartonNumber = item.cartonNumber;
    if (existing.packageCount == null && item.packageCount != null) data.packageCount = item.packageCount;
    if (existing.marksAndNumbers == null && item.marksAndNumbers) data.marksAndNumbers = item.marksAndNumbers;
    if (existing.grossWeight == null && item.grossWeight != null) data.grossWeight = new Prisma.Decimal(item.grossWeight);
    if (existing.netWeight == null && item.netWeight != null) data.netWeight = new Prisma.Decimal(item.netWeight);
    if (existing.weightUom == null && item.weightUom) data.weightUom = item.weightUom;
    if (existing.dimensions == null && item.dimensions) data.dimensions = item.dimensions;
    if (existing.volume == null && item.volume != null) data.volume = new Prisma.Decimal(item.volume);
    if (existing.volumeUom == null && item.volumeUom) data.volumeUom = item.volumeUom;
    if (existing.containedItems.length === 0 && item.containedItems?.length) data.containedItems = item.containedItems;

    if (Object.keys(data).length === 0) return;
    await client.shipmentPackage.update({ where: { id: existing.id }, data });
  }
}
