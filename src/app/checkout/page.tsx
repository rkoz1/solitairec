// Checkout is handled by Wix hosted checkout via redirect session.
// This page exists only as a fallback — redirect to cart.
import { redirect } from "next/navigation";

export default function CheckoutPage() {
  redirect("/cart");
}
