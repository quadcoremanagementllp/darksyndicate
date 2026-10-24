export type CheckoutAdjustment = {
  discountPaise?: number;
  finalPricePaise?: number;
};

export function calculateSessionCheckout(grossPaise: number, paidPaise: number, adjustment: CheckoutAdjustment) {
  if (!Number.isSafeInteger(grossPaise) || grossPaise < 0 || !Number.isSafeInteger(paidPaise) || paidPaise < 0) {
    throw new Error('Invalid session amounts');
  }
  if (adjustment.discountPaise !== undefined && adjustment.finalPricePaise !== undefined) {
    throw new Error('Choose a discount or a final price, not both');
  }
  const discount = adjustment.discountPaise ?? 0;
  const finalPricePaise = adjustment.finalPricePaise ?? grossPaise - discount;
  if (!Number.isSafeInteger(discount) || discount < 0 || discount > grossPaise ||
      !Number.isSafeInteger(finalPricePaise) || finalPricePaise < 0 || finalPricePaise > 100_000_000) {
    throw new Error('Invalid checkout adjustment');
  }
  return {
    finalPricePaise,
    discountPaise: Math.max(0, grossPaise - finalPricePaise),
    duePaise: Math.max(0, finalPricePaise - paidPaise),
    refundPaise: Math.max(0, paidPaise - finalPricePaise),
  };
}
