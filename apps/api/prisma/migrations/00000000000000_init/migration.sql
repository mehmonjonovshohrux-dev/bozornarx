-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'PASSWORD_RESET', 'CHANGE_EMAIL', 'CHANGE_PHONE');

-- CreateEnum
CREATE TYPE "RegionType" AS ENUM ('VILOYAT', 'TUMAN', 'SHAHAR', 'MAHALLA');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UnitDimension" AS ENUM ('MASS', 'VOLUME', 'COUNT', 'LENGTH', 'AREA', 'CUBIC', 'PACK');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('SELLER', 'FIELD_AGENT', 'USER_REPORT');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TrustStatus" AS ENUM ('INSUFFICIENT_DATA', 'SCORED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlertDirection" AS ENUM ('BELOW', 'ABOVE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('SALE', 'DELIVERY', 'WHOLESALE', 'SUPPLY', 'PARTNERSHIP', 'SERVICE', 'PLATFORM_OFFER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'PARTIALLY_SIGNED', 'FULLY_SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('EIMZO');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'PROVIDER_NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'ACCEPTED', 'RETURN_REQUESTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'APPEALED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "mfaSecretEnc" TEXT,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "avatarKey" TEXT,
    "regionId" UUID,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "notificationPrefs" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" UUID,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "prevRefreshHash" TEXT,
    "deviceHash" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "type" "RegionType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" UUID NOT NULL,
    "regionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "regionId" UUID NOT NULL,
    "marketId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "StoreStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerDocument" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" "UnitDimension" NOT NULL,
    "toBase" DECIMAL(18,6),

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unitId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRecord" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "storeId" UUID NOT NULL,
    "regionId" UUID NOT NULL,
    "marketId" UUID,
    "unitId" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "quantityAvailable" DECIMAL(18,4),
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "deliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
    "discountPercent" DECIMAL(5,2),
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "source" "PriceSource" NOT NULL DEFAULT 'SELLER',
    "moderationStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" UUID NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" UUID NOT NULL,
    "priceRecordId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "regionId" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "availability" "Availability" NOT NULL,
    "changedById" UUID,
    "reason" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceEvidence" (
    "id" UUID NOT NULL,
    "priceRecordId" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustAssessment" (
    "id" UUID NOT NULL,
    "priceRecordId" UUID NOT NULL,
    "status" "TrustStatus" NOT NULL,
    "score" INTEGER,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "regionId" UUID,
    "direction" "AlertDirection" NOT NULL,
    "targetPrice" DECIMAL(14,2) NOT NULL,
    "unitCode" TEXT NOT NULL,
    "channels" "NotificationChannel"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "buyerId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "couponCode" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "deliveryMethod" TEXT,
    "deliveryAddress" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "unitId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "priceRecordId" UUID,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "address" TEXT,
    "carrier" TEXT,
    "trackingRef" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "evidenceKeys" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "orderId" UUID,
    "buyerId" UUID NOT NULL,
    "sellerStoreId" UUID NOT NULL,
    "signedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "pdfKey" TEXT,
    "sha256" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractSignature" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "signerId" UUID NOT NULL,
    "partyRole" "PartyRole" NOT NULL,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'EIMZO',
    "signedDocSha256" TEXT NOT NULL,
    "signatureBlob" BYTEA,
    "certSerial" TEXT,
    "certSubject" TEXT,
    "certValidFrom" TIMESTAMP(3),
    "certValidTo" TIMESTAMP(3),
    "timestampToken" BYTEA,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationDetail" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractEvent" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "actorId" UUID,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "blockedById" UUID,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT,
    "attachmentKey" TEXT,
    "attachmentType" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "orderId" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" UUID NOT NULL,
    "filedById" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" UUID NOT NULL,
    "complaintId" UUID,
    "orderId" UUID,
    "contractId" UUID,
    "openedById" UUID NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" UUID NOT NULL,
    "moderatorId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "appealOfId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "plan" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PendingRegistration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "roleName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "priceRecordId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "priceRecordId" UUID NOT NULL,
    "delta" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "minAmount" DECIMAL(14,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleTier" (
    "id" UUID NOT NULL,
    "priceRecordId" UUID NOT NULL,
    "minQuantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "WholesaleTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "priceRecordId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "offeredUnitPrice" DECIMAL(14,2) NOT NULL,
    "counterUnitPrice" DECIMAL(14,2),
    "message" TEXT,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'PICKUP',
    "deliveryAddress" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" UUID NOT NULL,
    "type" "ContractType" NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "clauses" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceUzs" DECIMAL(14,2) NOT NULL,
    "maxProducts" INTEGER NOT NULL,
    "features" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "actorId" UUID,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "EmailVerification_userId_purpose_createdAt_idx" ON "EmailVerification"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneVerification_userId_purpose_createdAt_idx" ON "PhoneVerification"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_prevRefreshHash_idx" ON "Session"("prevRefreshHash");

-- CreateIndex
CREATE UNIQUE INDEX "Region_slug_key" ON "Region"("slug");

-- CreateIndex
CREATE INDEX "Region_parentId_idx" ON "Region"("parentId");

-- CreateIndex
CREATE INDEX "Market_regionId_idx" ON "Market"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");

-- CreateIndex
CREATE INDEX "Store_regionId_status_idx" ON "Store"("regionId", "status");

-- CreateIndex
CREATE INDEX "SellerDocument_storeId_status_idx" ON "SellerDocument"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_name_key" ON "ProductVariant"("productId", "name");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "PriceRecord_productId_regionId_moderationStatus_idx" ON "PriceRecord"("productId", "regionId", "moderationStatus");

-- CreateIndex
CREATE INDEX "PriceRecord_regionId_updatedAt_idx" ON "PriceRecord"("regionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceRecord_storeId_productId_variantId_key" ON "PriceRecord"("storeId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_regionId_recordedAt_idx" ON "PriceHistory"("productId", "regionId", "recordedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_priceRecordId_recordedAt_idx" ON "PriceHistory"("priceRecordId", "recordedAt");

-- CreateIndex
CREATE INDEX "PriceEvidence_priceRecordId_idx" ON "PriceEvidence"("priceRecordId");

-- CreateIndex
CREATE INDEX "TrustAssessment_priceRecordId_computedAt_idx" ON "TrustAssessment"("priceRecordId", "computedAt");

-- CreateIndex
CREATE INDEX "PriceAlert_productId_active_idx" ON "PriceAlert"("productId", "active");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_buyerId_status_idx" ON "Order"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Order_storeId_status_idx" ON "Order"("storeId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerRef_key" ON "Payment"("provider", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_orderId_key" ON "Delivery"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_number_key" ON "Contract"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_orderId_key" ON "Contract"("orderId");

-- CreateIndex
CREATE INDEX "Contract_buyerId_status_idx" ON "Contract"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Contract_sellerStoreId_status_idx" ON "Contract"("sellerStoreId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_contractId_version_key" ON "ContractVersion"("contractId", "version");

-- CreateIndex
CREATE INDEX "ContractSignature_contractId_idx" ON "ContractSignature"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractSignature_versionId_partyRole_key" ON "ContractSignature"("versionId", "partyRole");

-- CreateIndex
CREATE INDEX "ContractEvent_contractId_createdAt_idx" ON "ContractEvent"("contractId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_buyerId_storeId_key" ON "Conversation"("buyerId", "storeId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Review_storeId_status_idx" ON "Review"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_authorId_orderId_key" ON "Review"("authorId", "orderId");

-- CreateIndex
CREATE INDEX "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_targetType_targetId_idx" ON "Complaint"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_targetType_targetId_idx" ON "ModerationAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationAction_moderatorId_createdAt_idx" ON "ModerationAction"("moderatorId", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_storeId_status_idx" ON "Subscription"("storeId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_userId_key" ON "PendingRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_priceRecordId_key" ON "CartItem"("cartId", "priceRecordId");

-- CreateIndex
CREATE INDEX "StockMovement_priceRecordId_createdAt_idx" ON "StockMovement"("priceRecordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_storeId_code_key" ON "Discount"("storeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleTier_priceRecordId_minQuantity_key" ON "WholesaleTier"("priceRecordId", "minQuantity");

-- CreateIndex
CREATE INDEX "Offer_buyerId_status_idx" ON "Offer"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Offer_storeId_status_idx" ON "Offer"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_type_name_version_key" ON "ContractTemplate"("type", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "FileObject_ownerId_kind_idx" ON "FileObject"("ownerId", "kind");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVerification" ADD CONSTRAINT "PhoneVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_priceRecordId_fkey" FOREIGN KEY ("priceRecordId") REFERENCES "PriceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceEvidence" ADD CONSTRAINT "PriceEvidence_priceRecordId_fkey" FOREIGN KEY ("priceRecordId") REFERENCES "PriceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAssessment" ADD CONSTRAINT "TrustAssessment_priceRecordId_fkey" FOREIGN KEY ("priceRecordId") REFERENCES "PriceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_sellerStoreId_fkey" FOREIGN KEY ("sellerStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContractVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEvent" ADD CONSTRAINT "ContractEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_filedById_fkey" FOREIGN KEY ("filedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_appealOfId_fkey" FOREIGN KEY ("appealOfId") REFERENCES "ModerationAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingRegistration" ADD CONSTRAINT "PendingRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
