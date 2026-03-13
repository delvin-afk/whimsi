import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const styles = {
  base: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
  primary: "bg-black text-white hover:bg-neutral-800",
  secondary: "border border-neutral-200 bg-white hover:bg-neutral-50",
  ghost: "hover:bg-neutral-100",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: Props) {
  return (
    <button
      className={`${styles.base} ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
