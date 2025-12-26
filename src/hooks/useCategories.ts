import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';

// ============================================
// TYPES
// ============================================
export interface Category {
    id: number;
    name: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

// ============================================
// QUERY KEYS
// ============================================
export const categoryKeys = {
    all: ['categories'] as const,
    list: () => [...categoryKeys.all, 'list'] as const,
};

// ============================================
// FETCH FUNCTIONS
// ============================================
const fetchCategories = async (): Promise<Category[]> => {
    const response = await fetch(`${API_BASE_URL}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    const data = await response.json();
    return data.categories || [];
};

// ============================================
// HOOKS
// ============================================

/**
 * Hook to fetch all categories with caching
 */
export function useCategories() {
    return useQuery({
        queryKey: categoryKeys.list(),
        queryFn: fetchCategories,
        staleTime: 10 * 60 * 1000, // Categories rarely change, cache for 10 minutes
    });
}

/**
 * Hook to get category names as string array (for backward compatibility)
 */
export function useCategoryNames() {
    const { data: categories = [] } = useCategories();
    return categories.map(c => c.name);
}

/**
 * Hook for category mutations (create, update, delete)
 * Automatically invalidates categories cache after mutation
 */
export function useCategoryMutations() {
    const queryClient = useQueryClient();
    const { getAuthToken } = useAuth();

    const invalidateCategories = () => {
        queryClient.invalidateQueries({ queryKey: categoryKeys.all });
        // Also invalidate product categories since they depend on this
        queryClient.invalidateQueries({ queryKey: ['products', 'categories'] });
    };

    const createCategory = useMutation({
        mutationFn: async (categoryData: { name: string; description?: string }) => {
            const token = await getAuthToken();
            const response = await fetch(`${API_BASE_URL}/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(categoryData),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create category');
            }
            return response.json();
        },
        onSuccess: invalidateCategories,
    });

    const updateCategory = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: { name?: string; description?: string } }) => {
            const token = await getAuthToken();
            const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update category');
            }
            return response.json();
        },
        onSuccess: invalidateCategories,
    });

    const deleteCategory = useMutation({
        mutationFn: async (id: number) => {
            const token = await getAuthToken();
            const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete category');
            }
            return response.json();
        },
        onSuccess: invalidateCategories,
    });

    return { createCategory, updateCategory, deleteCategory };
}
