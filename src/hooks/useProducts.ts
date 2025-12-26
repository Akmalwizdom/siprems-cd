import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { Product } from '../types';

// ============================================
// QUERY KEYS - Centralized for cache management
// ============================================
export const productKeys = {
    all: ['products'] as const,
    lists: () => [...productKeys.all, 'list'] as const,
    list: (filters: { category?: string; search?: string }) => [...productKeys.lists(), filters] as const,
    detail: (id: string) => [...productKeys.all, 'detail', id] as const,
    categories: () => [...productKeys.all, 'categories'] as const,
};

// ============================================
// FETCH FUNCTIONS
// ============================================
const fetchAllProducts = async (): Promise<Product[]> => {
    const response = await fetch(`${API_BASE_URL}/products?limit=1000`);
    if (!response.ok) throw new Error('Failed to fetch products');
    const data = await response.json();

    return data.data.map((p: any) => ({
        id: p.id.toString(),
        name: p.name,
        category: p.category,
        costPrice: parseFloat(p.cost_price),
        sellingPrice: parseFloat(p.selling_price),
        stock: p.stock,
        imageUrl: p.image_url || '',
        description: p.description || '',
    }));
};

const fetchCategories = async (): Promise<string[]> => {
    const response = await fetch(`${API_BASE_URL}/products/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    const data = await response.json();
    return data.categories;
};

// ============================================
// HOOKS
// ============================================

/**
 * Hook to fetch all products with caching
 * Data is cached and instantly available on subsequent visits
 */
export function useProducts() {
    return useQuery({
        queryKey: productKeys.lists(),
        queryFn: fetchAllProducts,
        staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
    });
}

/**
 * Hook to fetch product categories as string array
 * @deprecated Use useCategoryNames from useCategories.ts instead
 */
export function useProductCategoryNames() {
    return useQuery({
        queryKey: productKeys.categories(),
        queryFn: fetchCategories,
        staleTime: 10 * 60 * 1000, // Categories rarely change, cache longer
    });
}

/**
 * Hook for product mutations (create, update, delete)
 * Automatically invalidates products cache after mutation
 */
export function useProductMutations() {
    const queryClient = useQueryClient();

    const invalidateProducts = () => {
        queryClient.invalidateQueries({ queryKey: productKeys.all });
    };

    const createProduct = useMutation({
        mutationFn: async (productData: {
            name: string;
            category: string;
            selling_price: number;
            cost_price: number;
            stock: number;
            description?: string;
        }) => {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create product');
            }
            return response.json();
        },
        onSuccess: invalidateProducts,
    });

    const updateProduct = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to update product');
            return response.json();
        },
        onSuccess: invalidateProducts,
    });

    const deleteProduct = useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete product');
            return response.json();
        },
        onSuccess: invalidateProducts,
    });

    return { createProduct, updateProduct, deleteProduct };
}
