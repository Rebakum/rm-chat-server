export interface CreateServiceDTO {
  title: string;
  description?: string;
  price: number;
  deliveryTime?: string;
  engLevel?: string;
  category?: string;
  featuredImage?: string;
  faqs?: { question: string; answer: string }[];
}

export interface UpdateServiceDTO {
  title?: string;
  description?: string;
  price?: number;
  deliveryTime?: string;
  engLevel?: string;
  category?: string;
  featuredImage?: string;
}

export interface ServiceQueryParams {
  page?: number;
  limit?: number;
}
