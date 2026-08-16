/**
 * AdminMarketplaceConfigPageContent — `/:locale/admin/marketplace-config`
 * (Stage 11.5: Marketplace Configuration). Six previously seed-only
 * lookup entities (categories, amenities, pricing models, countries,
 * regions, cities), each its own `Tabs` panel built on the shared
 * `ConfigEntityPanel` — see that file's and `useAdminConfigResource.js`'s
 * header comments for why one generic panel, not six near-duplicates.
 *
 * Per the Phase 11 plan's explicit scope decision, the EAV-style Dynamic
 * Attributes / Search Filters / Policy-definition editors are NOT built
 * here — deferred as a documented follow-up (comparable in size to the
 * engine that built their read side).
 *
 * None of these six tables is large enough to warrant pagination or
 * server-side filtering at this platform's scale — every tab lists its
 * full table, matching the "simple CRUD for simple lookup entities"
 * scope decision.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack } from '@travelhub/ui/components/layout';
import { Tabs } from '@travelhub/ui/components/navigation';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useAdminConfigResource } from '../../hooks/useAdminConfigResource.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAmenityGroups,
  getAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  getPricingModels,
  createPricingModel,
  updatePricingModel,
  deletePricingModel,
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,
  getRegions,
  createRegion,
  updateRegion,
  deleteRegion,
  getCities,
  createCity,
  updateCity,
  deleteCity,
} from '../../../../api/admin.js';
import ConfigEntityPanel from './ConfigEntityPanel.jsx';

export default function AdminMarketplaceConfigPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { permissions } = useAuth();
  const canConfigure = permissions.includes('marketplace.configure');
  const [activeTabId, setActiveTabId] = useState('categories');

  const categories = useAdminConfigResource({
    queryKey: ['admin', 'config', 'categories'],
    list: getCategories,
    create: createCategory,
    update: updateCategory,
    remove: deleteCategory,
  });
  // Read-only lookup (no CRUD UI) — only used to populate the Amenities
  // form's group picker, so a plain query rather than
  // `useAdminConfigResource` (which assumes create/update/delete exist).
  const amenityGroupsQuery = useQuery({
    queryKey: ['admin', 'config', 'amenity-groups'],
    queryFn: () => getAmenityGroups().then((response) => response.data),
  });
  const amenities = useAdminConfigResource({
    queryKey: ['admin', 'config', 'amenities'],
    list: getAmenities,
    create: createAmenity,
    update: updateAmenity,
    remove: deleteAmenity,
  });
  const pricingModels = useAdminConfigResource({
    queryKey: ['admin', 'config', 'pricing-models'],
    list: getPricingModels,
    create: createPricingModel,
    update: updatePricingModel,
    remove: deletePricingModel,
  });
  const countries = useAdminConfigResource({
    queryKey: ['admin', 'config', 'countries'],
    list: getCountries,
    create: createCountry,
    update: updateCountry,
    remove: deleteCountry,
  });
  const regions = useAdminConfigResource({
    queryKey: ['admin', 'config', 'regions'],
    list: () => getRegions(),
    create: createRegion,
    update: updateRegion,
    remove: deleteRegion,
  });
  const cities = useAdminConfigResource({
    queryKey: ['admin', 'config', 'cities'],
    list: () => getCities(),
    create: createCity,
    update: updateCity,
    remove: deleteCity,
  });

  const categoryRows = categories.listQuery.data ?? [];
  const amenityGroupRows = amenityGroupsQuery.data ?? [];
  const amenityRows = amenities.listQuery.data ?? [];
  const pricingModelRows = pricingModels.listQuery.data ?? [];
  const countryRows = countries.listQuery.data ?? [];
  const regionRows = regions.listQuery.data ?? [];
  const cityRows = cities.listQuery.data ?? [];

  // These lookup tables are small by design (never more than a handful
  // of dozens of rows) — rebuilding the Maps on every render is cheap
  // enough that memoizing them isn't worth the dependency-array upkeep.
  const countryNameById = new Map(countryRows.map((row) => [row.id, row.name]));
  const regionNameById = new Map(regionRows.map((row) => [row.id, row.name]));
  const categoryNameById = new Map(
    categoryRows.map((row) => [row.id, row.name]),
  );

  const noneOption = { value: '', label: t('admin.marketplaceConfig.none') };

  const cancelAction = t('common.cancel');
  const saveAction = t('common.save');

  const categoriesTab = (
    <ConfigEntityPanel
      heading={t('admin.marketplaceConfig.categories.heading')}
      addLabel={t('admin.marketplaceConfig.categories.addAction')}
      columns={[
        { key: 'name', header: t('admin.marketplaceConfig.table.name') },
        { key: 'slug', header: t('admin.marketplaceConfig.table.slug') },
        {
          key: 'parent',
          header: t('admin.marketplaceConfig.categories.parent'),
          render: (row) =>
            row.parent_id ? (categoryNameById.get(row.parent_id) ?? '—') : '—',
        },
      ]}
      rows={categoryRows}
      isPending={categories.listQuery.isPending}
      isError={categories.listQuery.isError}
      onRetry={categories.listQuery.refetch}
      fields={[
        {
          name: 'name',
          label: t('admin.marketplaceConfig.table.name'),
          required: true,
        },
        {
          name: 'slug',
          label: t('admin.marketplaceConfig.table.slug'),
          required: true,
        },
        {
          name: 'parentId',
          label: t('admin.marketplaceConfig.categories.parent'),
          type: 'select',
          options: [
            noneOption,
            ...categoryRows.map((row) => ({
              value: String(row.id),
              label: row.name,
            })),
          ],
        },
      ]}
      emptyValues={{ name: '', slug: '', parentId: '' }}
      toFormValues={(row) => ({
        name: row.name,
        slug: row.slug,
        parentId: row.parent_id ? String(row.parent_id) : '',
      })}
      getRowLabel={(row) => row.name}
      resource={categories}
      canWrite={canConfigure}
      copy={{
        formCreateTitle: t(
          'admin.marketplaceConfig.categories.formCreateTitle',
        ),
        formEditTitle: (name) =>
          t('admin.marketplaceConfig.categories.formEditTitle', { name }),
        deleteConfirmTitle: (name) =>
          t('admin.marketplaceConfig.categories.deleteConfirmTitle', { name }),
        deleteConfirmDescription: t(
          'admin.marketplaceConfig.categories.deleteConfirmDescription',
        ),
        saveAction,
        cancelAction,
        editAction: t('admin.marketplaceConfig.editAction'),
        deleteAction: t('admin.marketplaceConfig.deleteAction'),
        emptyTitle: t('admin.marketplaceConfig.categories.emptyTitle'),
        emptyDescription: t('admin.marketplaceConfig.emptyDescription'),
        errorTitle: t('admin.marketplaceConfig.errorTitle'),
        errorRetry: t('admin.marketplaceConfig.errorRetry'),
        createSuccess: t('admin.marketplaceConfig.categories.createSuccess'),
        updateSuccess: t('admin.marketplaceConfig.categories.updateSuccess'),
        deleteSuccess: t('admin.marketplaceConfig.categories.deleteSuccess'),
        saveError: t('admin.marketplaceConfig.saveError'),
        deleteError: t('admin.marketplaceConfig.deleteError'),
      }}
    />
  );

  const amenitiesTab = (
    <ConfigEntityPanel
      heading={t('admin.marketplaceConfig.amenities.heading')}
      addLabel={t('admin.marketplaceConfig.amenities.addAction')}
      columns={[
        { key: 'name', header: t('admin.marketplaceConfig.table.name') },
        {
          key: 'group',
          header: t('admin.marketplaceConfig.amenities.group'),
          render: (row) => row.amenity_group_name ?? '—',
        },
      ]}
      rows={amenityRows}
      isPending={amenities.listQuery.isPending || amenityGroupsQuery.isPending}
      isError={amenities.listQuery.isError}
      onRetry={amenities.listQuery.refetch}
      fields={[
        {
          name: 'name',
          label: t('admin.marketplaceConfig.table.name'),
          required: true,
        },
        {
          name: 'amenityGroupId',
          label: t('admin.marketplaceConfig.amenities.group'),
          type: 'select',
          options: [
            noneOption,
            ...amenityGroupRows.map((row) => ({
              value: String(row.id),
              label: row.name,
            })),
          ],
        },
      ]}
      emptyValues={{ name: '', amenityGroupId: '' }}
      toFormValues={(row) => ({
        name: row.name,
        amenityGroupId: row.amenity_group_id
          ? String(row.amenity_group_id)
          : '',
      })}
      getRowLabel={(row) => row.name}
      resource={amenities}
      canWrite={canConfigure}
      copy={{
        formCreateTitle: t('admin.marketplaceConfig.amenities.formCreateTitle'),
        formEditTitle: (name) =>
          t('admin.marketplaceConfig.amenities.formEditTitle', { name }),
        deleteConfirmTitle: (name) =>
          t('admin.marketplaceConfig.amenities.deleteConfirmTitle', { name }),
        deleteConfirmDescription: t(
          'admin.marketplaceConfig.amenities.deleteConfirmDescription',
        ),
        saveAction,
        cancelAction,
        editAction: t('admin.marketplaceConfig.editAction'),
        deleteAction: t('admin.marketplaceConfig.deleteAction'),
        emptyTitle: t('admin.marketplaceConfig.amenities.emptyTitle'),
        emptyDescription: t('admin.marketplaceConfig.emptyDescription'),
        errorTitle: t('admin.marketplaceConfig.errorTitle'),
        errorRetry: t('admin.marketplaceConfig.errorRetry'),
        createSuccess: t('admin.marketplaceConfig.amenities.createSuccess'),
        updateSuccess: t('admin.marketplaceConfig.amenities.updateSuccess'),
        deleteSuccess: t('admin.marketplaceConfig.amenities.deleteSuccess'),
        saveError: t('admin.marketplaceConfig.saveError'),
        deleteError: t('admin.marketplaceConfig.deleteError'),
      }}
    />
  );

  const pricingModelsTab = (
    <ConfigEntityPanel
      heading={t('admin.marketplaceConfig.pricingModels.heading')}
      addLabel={t('admin.marketplaceConfig.pricingModels.addAction')}
      columns={[
        { key: 'code', header: t('admin.marketplaceConfig.table.code') },
        { key: 'name', header: t('admin.marketplaceConfig.table.name') },
      ]}
      rows={pricingModelRows}
      isPending={pricingModels.listQuery.isPending}
      isError={pricingModels.listQuery.isError}
      onRetry={pricingModels.listQuery.refetch}
      fields={[
        {
          name: 'code',
          label: t('admin.marketplaceConfig.table.code'),
          required: true,
        },
        {
          name: 'name',
          label: t('admin.marketplaceConfig.table.name'),
          required: true,
        },
      ]}
      emptyValues={{ code: '', name: '' }}
      toFormValues={(row) => ({ code: row.code, name: row.name })}
      getRowLabel={(row) => row.name}
      resource={pricingModels}
      canWrite={canConfigure}
      copy={{
        formCreateTitle: t(
          'admin.marketplaceConfig.pricingModels.formCreateTitle',
        ),
        formEditTitle: (name) =>
          t('admin.marketplaceConfig.pricingModels.formEditTitle', { name }),
        deleteConfirmTitle: (name) =>
          t('admin.marketplaceConfig.pricingModels.deleteConfirmTitle', {
            name,
          }),
        deleteConfirmDescription: t(
          'admin.marketplaceConfig.pricingModels.deleteConfirmDescription',
        ),
        saveAction,
        cancelAction,
        editAction: t('admin.marketplaceConfig.editAction'),
        deleteAction: t('admin.marketplaceConfig.deleteAction'),
        emptyTitle: t('admin.marketplaceConfig.pricingModels.emptyTitle'),
        emptyDescription: t('admin.marketplaceConfig.emptyDescription'),
        errorTitle: t('admin.marketplaceConfig.errorTitle'),
        errorRetry: t('admin.marketplaceConfig.errorRetry'),
        createSuccess: t('admin.marketplaceConfig.pricingModels.createSuccess'),
        updateSuccess: t('admin.marketplaceConfig.pricingModels.updateSuccess'),
        deleteSuccess: t('admin.marketplaceConfig.pricingModels.deleteSuccess'),
        saveError: t('admin.marketplaceConfig.saveError'),
        deleteError: t('admin.marketplaceConfig.deleteError'),
      }}
    />
  );

  const countriesTab = (
    <ConfigEntityPanel
      heading={t('admin.marketplaceConfig.countries.heading')}
      addLabel={t('admin.marketplaceConfig.countries.addAction')}
      columns={[
        { key: 'iso_code', header: t('admin.marketplaceConfig.table.isoCode') },
        { key: 'name', header: t('admin.marketplaceConfig.table.name') },
      ]}
      rows={countryRows}
      isPending={countries.listQuery.isPending}
      isError={countries.listQuery.isError}
      onRetry={countries.listQuery.refetch}
      fields={[
        {
          name: 'isoCode',
          label: t('admin.marketplaceConfig.table.isoCode'),
          required: true,
        },
        {
          name: 'name',
          label: t('admin.marketplaceConfig.table.name'),
          required: true,
        },
      ]}
      emptyValues={{ isoCode: '', name: '' }}
      toFormValues={(row) => ({ isoCode: row.iso_code, name: row.name })}
      getRowLabel={(row) => row.name}
      resource={countries}
      canWrite={canConfigure}
      copy={{
        formCreateTitle: t('admin.marketplaceConfig.countries.formCreateTitle'),
        formEditTitle: (name) =>
          t('admin.marketplaceConfig.countries.formEditTitle', { name }),
        deleteConfirmTitle: (name) =>
          t('admin.marketplaceConfig.countries.deleteConfirmTitle', { name }),
        deleteConfirmDescription: t(
          'admin.marketplaceConfig.countries.deleteConfirmDescription',
        ),
        saveAction,
        cancelAction,
        editAction: t('admin.marketplaceConfig.editAction'),
        deleteAction: t('admin.marketplaceConfig.deleteAction'),
        emptyTitle: t('admin.marketplaceConfig.countries.emptyTitle'),
        emptyDescription: t('admin.marketplaceConfig.emptyDescription'),
        errorTitle: t('admin.marketplaceConfig.errorTitle'),
        errorRetry: t('admin.marketplaceConfig.errorRetry'),
        createSuccess: t('admin.marketplaceConfig.countries.createSuccess'),
        updateSuccess: t('admin.marketplaceConfig.countries.updateSuccess'),
        deleteSuccess: t('admin.marketplaceConfig.countries.deleteSuccess'),
        saveError: t('admin.marketplaceConfig.saveError'),
        deleteError: t('admin.marketplaceConfig.deleteError'),
      }}
    />
  );

  const regionsTab = (
    <ConfigEntityPanel
      heading={t('admin.marketplaceConfig.regions.heading')}
      addLabel={t('admin.marketplaceConfig.regions.addAction')}
      columns={[
        { key: 'name', header: t('admin.marketplaceConfig.table.name') },
        {
          key: 'country',
          header: t('admin.marketplaceConfig.regions.country'),
          render: (row) => countryNameById.get(row.country_id) ?? '—',
        },
      ]}
      rows={regionRows}
      isPending={regions.listQuery.isPending || countries.listQuery.isPending}
      isError={regions.listQuery.isError}
      onRetry={regions.listQuery.refetch}
      fields={[
        {
          name: 'name',
          label: t('admin.marketplaceConfig.table.name'),
          required: true,
        },
        {
          name: 'countryId',
          label: t('admin.marketplaceConfig.regions.country'),
          type: 'select',
          options: countryRows.map((row) => ({
            value: String(row.id),
            label: row.name,
          })),
        },
      ]}
      emptyValues={{ name: '', countryId: '' }}
      toFormValues={(row) => ({
        name: row.name,
        countryId: String(row.country_id),
      })}
      getRowLabel={(row) => row.name}
      resource={regions}
      canWrite={canConfigure}
      copy={{
        formCreateTitle: t('admin.marketplaceConfig.regions.formCreateTitle'),
        formEditTitle: (name) =>
          t('admin.marketplaceConfig.regions.formEditTitle', { name }),
        deleteConfirmTitle: (name) =>
          t('admin.marketplaceConfig.regions.deleteConfirmTitle', { name }),
        deleteConfirmDescription: t(
          'admin.marketplaceConfig.regions.deleteConfirmDescription',
        ),
        saveAction,
        cancelAction,
        editAction: t('admin.marketplaceConfig.editAction'),
        deleteAction: t('admin.marketplaceConfig.deleteAction'),
        emptyTitle: t('admin.marketplaceConfig.regions.emptyTitle'),
        emptyDescription: t('admin.marketplaceConfig.emptyDescription'),
        errorTitle: t('admin.marketplaceConfig.errorTitle'),
        errorRetry: t('admin.marketplaceConfig.errorRetry'),
        createSuccess: t('admin.marketplaceConfig.regions.createSuccess'),
        updateSuccess: t('admin.marketplaceConfig.regions.updateSuccess'),
        deleteSuccess: t('admin.marketplaceConfig.regions.deleteSuccess'),
        saveError: t('admin.marketplaceConfig.saveError'),
        deleteError: t('admin.marketplaceConfig.deleteError'),
      }}
    />
  );

  const citiesTab = (
    <ConfigEntityPanel
      heading={t('admin.marketplaceConfig.cities.heading')}
      addLabel={t('admin.marketplaceConfig.cities.addAction')}
      columns={[
        { key: 'name', header: t('admin.marketplaceConfig.table.name') },
        { key: 'slug', header: t('admin.marketplaceConfig.table.slug') },
        {
          key: 'region',
          header: t('admin.marketplaceConfig.cities.region'),
          render: (row) => regionNameById.get(row.region_id) ?? '—',
        },
      ]}
      rows={cityRows}
      isPending={cities.listQuery.isPending || regions.listQuery.isPending}
      isError={cities.listQuery.isError}
      onRetry={cities.listQuery.refetch}
      fields={[
        {
          name: 'name',
          label: t('admin.marketplaceConfig.table.name'),
          required: true,
        },
        {
          name: 'slug',
          label: t('admin.marketplaceConfig.table.slug'),
          required: true,
        },
        {
          name: 'regionId',
          label: t('admin.marketplaceConfig.cities.region'),
          type: 'select',
          options: regionRows.map((row) => ({
            value: String(row.id),
            label: row.name,
          })),
        },
        {
          name: 'latitude',
          label: t('admin.marketplaceConfig.cities.latitude'),
          numeric: true,
          step: 'any',
        },
        {
          name: 'longitude',
          label: t('admin.marketplaceConfig.cities.longitude'),
          numeric: true,
          step: 'any',
        },
      ]}
      emptyValues={{
        name: '',
        slug: '',
        regionId: '',
        latitude: '',
        longitude: '',
      }}
      toFormValues={(row) => ({
        name: row.name,
        slug: row.slug,
        regionId: String(row.region_id),
        latitude: row.latitude ?? '',
        longitude: row.longitude ?? '',
      })}
      getRowLabel={(row) => row.name}
      resource={cities}
      canWrite={canConfigure}
      copy={{
        formCreateTitle: t('admin.marketplaceConfig.cities.formCreateTitle'),
        formEditTitle: (name) =>
          t('admin.marketplaceConfig.cities.formEditTitle', { name }),
        deleteConfirmTitle: (name) =>
          t('admin.marketplaceConfig.cities.deleteConfirmTitle', { name }),
        deleteConfirmDescription: t(
          'admin.marketplaceConfig.cities.deleteConfirmDescription',
        ),
        saveAction,
        cancelAction,
        editAction: t('admin.marketplaceConfig.editAction'),
        deleteAction: t('admin.marketplaceConfig.deleteAction'),
        emptyTitle: t('admin.marketplaceConfig.cities.emptyTitle'),
        emptyDescription: t('admin.marketplaceConfig.emptyDescription'),
        errorTitle: t('admin.marketplaceConfig.errorTitle'),
        errorRetry: t('admin.marketplaceConfig.errorRetry'),
        createSuccess: t('admin.marketplaceConfig.cities.createSuccess'),
        updateSuccess: t('admin.marketplaceConfig.cities.updateSuccess'),
        deleteSuccess: t('admin.marketplaceConfig.cities.deleteSuccess'),
        saveError: t('admin.marketplaceConfig.saveError'),
        deleteError: t('admin.marketplaceConfig.deleteError'),
      }}
    />
  );

  const tabs = [
    {
      id: 'categories',
      label: t('admin.marketplaceConfig.tabs.categories'),
      panel: categoriesTab,
    },
    {
      id: 'amenities',
      label: t('admin.marketplaceConfig.tabs.amenities'),
      panel: amenitiesTab,
    },
    {
      id: 'pricingModels',
      label: t('admin.marketplaceConfig.tabs.pricingModels'),
      panel: pricingModelsTab,
    },
    {
      id: 'countries',
      label: t('admin.marketplaceConfig.tabs.countries'),
      panel: countriesTab,
    },
    {
      id: 'regions',
      label: t('admin.marketplaceConfig.tabs.regions'),
      panel: regionsTab,
    },
    {
      id: 'cities',
      label: t('admin.marketplaceConfig.tabs.cities'),
      panel: citiesTab,
    },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.marketplaceConfig.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.marketplaceConfig.heading'),
            href: `/${locale}/admin/marketplace-config`,
          },
        ]}
      />
      <Stack gap="4">
        <Tabs
          tabs={tabs}
          activeTabId={activeTabId}
          onChange={setActiveTabId}
          ariaLabel={t('admin.marketplaceConfig.heading')}
        />
      </Stack>
    </Section>
  );
}
