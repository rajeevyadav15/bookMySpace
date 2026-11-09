let loading = null;

// Loads Razorpay checkout script only when needed
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();

  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => {
        loading = null;
        reject(new Error("Could not load Razorpay. Check your internet"));
      };
      document.body.appendChild(script);
    });
  }

  return loading;
}