import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CrateCard from '@/components/crates/CrateCard';
import CrateFormDialog from '@/components/crates/CrateFormDialog';
import CrateDetailSheet from '@/components/crates/CrateDetailSheet';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function Crates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingCrate, setEditingCrate] = useState(null);
  const [selectedCrate, setSelectedCrate] = useState(null);
  const [crateToDelete, setCrateToDelete] = useState(null);

  const { data: crates = [], isLoading } = useQuery({
    queryKey: ['crates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crates')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: collection = [] } = useQuery({
    queryKey: ['user-collection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('crates')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crates'] });
      toast.success('Crate deleted');
      setCrateToDelete(null);
    },
    onError: (error) => {
      toast.error('Failed to delete crate: ' + (error.message || 'Unknown error'));
    },
  });

  const openEdit = (crate, e) => {
    e.stopPropagation();
    setEditingCrate(crate);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCrate(null);
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/collection')} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-base font-display font-bold text-foreground tracking-wide">Crates</h1>
            <p className="text-[11px] font-mono text-muted-foreground">{crates.length} crate{crates.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button
          size="sm"
          className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-3.5 h-3.5" /> New Crate
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : crates.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 px-8 text-center">
          <PackageOpen className="w-14 h-14 text-muted-foreground/20" />
          <p className="text-sm font-display font-semibold text-foreground">No Crates Yet</p>
          <p className="text-xs font-mono text-muted-foreground">Create a crate to organise your collection — e.g. "Rare Finds" or "Summer Editions"</p>
          <Button
            size="sm"
            className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Create First Crate
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {crates.map(crate => (
            <CrateCard
              key={crate.id}
              crate={crate}
              collection={collection}
              onClick={() => setSelectedCrate(crate)}
              onEdit={(e) => openEdit(crate, e)}
              onDelete={(e) => { e.stopPropagation(); setCrateToDelete(crate); }}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CrateFormDialog
          crate={editingCrate}
          onClose={closeForm}
          userId={user?.id}
        />
      )}

      {selectedCrate && (
        <CrateDetailSheet
          crate={selectedCrate}
          collection={collection}
          onClose={() => setSelectedCrate(null)}
          onCrateUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['crates'] });
            // refresh the selected crate from updated list
          }}
        />
      )}

      <ConfirmDialog
        open={!!crateToDelete}
        onCancel={() => setCrateToDelete(null)}
        onConfirm={() => deleteMutation.mutate(crateToDelete.id)}
        isPending={deleteMutation.isPending}
        title="Delete Crate?"
        description={
          <>
            <span className="text-foreground font-semibold">{crateToDelete?.name}</span> will be deleted. The cans inside stay in your collection — only the crate organization is removed. This cannot be undone.
          </>
        }
      />
    </div>
  );
}
