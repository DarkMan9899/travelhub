import { Container } from '@travelhub/ui/components/layout';
import { CompanyProfilePageContent } from '../modules/companies/index.js';

export default function CompanyProfilePage() {
  return (
    <Container size="wide">
      <CompanyProfilePageContent />
    </Container>
  );
}
