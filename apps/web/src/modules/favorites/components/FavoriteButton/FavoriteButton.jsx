/**
 * FavoriteButton — heart-toggle icon button for listing cards (Home,
 * Search results, Listing Detail). Reads `useFavoriteIdsQuery`'s cached
 * id list itself (a single shared React Query cache entry, so mounting
 * this on every card in a grid never re-fetches per card) rather than
 * requiring each card's parent to thread favorite state down.
 *
 * Renders nothing for a logged-out visitor — favorites are always the
 * caller's own; there's no "sign in to save this" flow in this phase's
 * scope, matching `ReviewForm`'s own "only ever shown to an authenticated
 * customer" precedent.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { Button } from '@desavii/ui/components/primitives';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useFavoriteIdsQuery } from '../../queries/useFavoriteIdsQuery.js';
import { useToggleFavoriteMutation } from '../../mutations/useToggleFavoriteMutation.js';
import styles from './FavoriteButton.module.scss';

export default function FavoriteButton({ listingId, className = undefined }) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: favoriteIds } = useFavoriteIdsQuery({
    enabled: isAuthenticated,
  });
  const toggleMutation = useToggleFavoriteMutation();

  if (!isAuthenticated) return null;

  const isFavorited = (favoriteIds ?? []).includes(listingId);

  function handleClick(event) {
    // Cards are themselves interactive links — this button sits on top
    // of one and must never trigger the card's own navigation.
    event.preventDefault();
    event.stopPropagation();
    toggleMutation.mutate({ listingId, isFavorited });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={[styles.button, className].filter(Boolean).join(' ')}
      ariaLabel={
        isFavorited ? t('favorites.button.remove') : t('favorites.button.add')
      }
      onClick={(event) => handleClick(event)}
      disabled={toggleMutation.isPending}
      iconLeft={
        <Heart
          size={18}
          aria-hidden="true"
          fill={isFavorited ? 'currentColor' : 'none'}
        />
      }
    />
  );
}

FavoriteButton.propTypes = {
  listingId: PropTypes.number.isRequired,
  className: PropTypes.string,
};
