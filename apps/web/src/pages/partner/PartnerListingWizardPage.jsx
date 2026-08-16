import { PartnerListingWizard } from '../../modules/listings/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function PartnerListingWizardPage() {
  const { partnerships } = useAuth();
  return <PartnerListingWizard partnerships={partnerships} />;
}
