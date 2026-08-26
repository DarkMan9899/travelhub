import { Container } from '@desavii/ui/components/layout';
import { CompaniesDirectoryPageContent } from '../modules/companies/index.js';

export default function CompaniesPage() {
  return (
    <Container size="wide">
      <CompaniesDirectoryPageContent />
    </Container>
  );
}
