import React from 'react';

interface BillyWordmarkProps {
  className?: string;
}

export const BillyWordmark: React.FC<BillyWordmarkProps> = ({ className = 'h-9 w-auto' }) => {
  return (
    <div className={`flex flex-col justify-center select-none ${className}`}>
      <div className="flex items-center gap-1.5 leading-none">
        <span className="text-lg font-extrabold tracking-tight text-white font-sans">
          Viora
        </span>
        <span className="text-lg font-bold tracking-tight text-[#FF6A2B] font-sans">
          Bills
        </span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF6A2B] ml-0.5" />
      </div>
      <span className="text-[8.5px] font-bold tracking-[0.16em] uppercase text-[#8FB4E3] mt-1 font-sans">
        BILLING | INVOICING | PAYMENTS
      </span>
    </div>
  );
};
