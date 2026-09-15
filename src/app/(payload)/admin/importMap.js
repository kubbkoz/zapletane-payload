import { PriceCell as PriceCell_e27bf7b8cc50640dcdd584767b8eac3c } from '@payloadcms/plugin-ecommerce/client'
import { PriceInput as PriceInput_b91672ccd6e8b071c11142ab941fedfb } from '@payloadcms/plugin-ecommerce/rsc'
import { RscEntryLexicalCell as RscEntryLexicalCell_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { RscEntryLexicalField as RscEntryLexicalField_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { LexicalDiffComponent as LexicalDiffComponent_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { InlineToolbarFeatureClient as InlineToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { FixedToolbarFeatureClient as FixedToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { HeadingFeatureClient as HeadingFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { UnderlineFeatureClient as UnderlineFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { BoldFeatureClient as BoldFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ItalicFeatureClient as ItalicFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { OrderedListFeatureClient as OrderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { UnorderedListFeatureClient as UnorderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { LinkFeatureClient as LinkFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { IndentFeatureClient as IndentFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { TableFeatureClient as TableFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { OverviewComponent as OverviewComponent_a8a977ebc872c5d5ea7ee689724c0860 } from '@payloadcms/plugin-seo/client'
import { MetaTitleComponent as MetaTitleComponent_a8a977ebc872c5d5ea7ee689724c0860 } from '@payloadcms/plugin-seo/client'
import { MetaImageComponent as MetaImageComponent_a8a977ebc872c5d5ea7ee689724c0860 } from '@payloadcms/plugin-seo/client'
import { MetaDescriptionComponent as MetaDescriptionComponent_a8a977ebc872c5d5ea7ee689724c0860 } from '@payloadcms/plugin-seo/client'
import { PreviewComponent as PreviewComponent_a8a977ebc872c5d5ea7ee689724c0860 } from '@payloadcms/plugin-seo/client'
import { GenerateArticleButton as GenerateArticleButton_e6d4dadec655c9986798da4569523591 } from '@/components/admin/GenerateArticleButton'
import { BlocksFeatureClient as BlocksFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { HorizontalRuleFeatureClient as HorizontalRuleFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ScraperJobControls as ScraperJobControls_54c2152edd141df45ff6246d637d64e0 } from '@/components/admin/ScraperJobControls'
import { ScraperJobCategories as ScraperJobCategories_94b6c833d548b2586430bc92ae85424d } from '@/components/admin/ScraperJobCategories'
import { ScraperJobPreviews as ScraperJobPreviews_1c84b06a05c8a26ced6d29b226b0c933 } from '@/components/admin/ScraperJobPreviews'
import { VariantOptionsSelector as VariantOptionsSelector_b91672ccd6e8b071c11142ab941fedfb } from '@payloadcms/plugin-ecommerce/rsc'
import { PurgeCacheButton as PurgeCacheButton_967dc17052d37888c9ed04fb08af2bb7 } from '@/components/admin/PurgeCacheButton'
import { StatsView as StatsView_019064b858e8ae6d080010e39be16092 } from '@/components/admin/StatsView'
import { Icon as Icon_534076e2c753ea5d539a54b05f456b1b } from '@/components/admin/Icon'
import { Logo as Logo_a44df17d0fc3dcd873dae43dc3bf66bd } from '@/components/admin/Logo'
import { BeforeDashboard as BeforeDashboard_1a7510af427896d367a49dbf838d2de6 } from '@/components/BeforeDashboard'
import { RecentOrders as RecentOrders_b612e731223fb07b8283add29afed720 } from '@/components/admin/RecentOrders'
import { StatsSummary as StatsSummary_6c08412ac035a619107044245a9c0c48 } from '@/components/admin/StatsSummary'
import { BeforeLogin as BeforeLogin_8a7ab0eb7ab5c511aba12e68480bfe5e } from '@/components/BeforeLogin'
import { BrandFonts as BrandFonts_90f8fc7531fcce4c65370cfaaa680a41 } from '@/components/admin/BrandFonts'
import { VercelBlobClientUploadHandler as VercelBlobClientUploadHandler_16c82c5e25f430251a3e3ba57219ff4e } from '@payloadcms/storage-vercel-blob/client'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  "@payloadcms/plugin-ecommerce/client#PriceCell": PriceCell_e27bf7b8cc50640dcdd584767b8eac3c,
  "@payloadcms/plugin-ecommerce/rsc#PriceInput": PriceInput_b91672ccd6e8b071c11142ab941fedfb,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalCell": RscEntryLexicalCell_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalField": RscEntryLexicalField_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/rsc#LexicalDiffComponent": LexicalDiffComponent_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/client#InlineToolbarFeatureClient": InlineToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#FixedToolbarFeatureClient": FixedToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#HeadingFeatureClient": HeadingFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#UnderlineFeatureClient": UnderlineFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#BoldFeatureClient": BoldFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#ItalicFeatureClient": ItalicFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#OrderedListFeatureClient": OrderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#UnorderedListFeatureClient": UnorderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#LinkFeatureClient": LinkFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#IndentFeatureClient": IndentFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#TableFeatureClient": TableFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/plugin-seo/client#OverviewComponent": OverviewComponent_a8a977ebc872c5d5ea7ee689724c0860,
  "@payloadcms/plugin-seo/client#MetaTitleComponent": MetaTitleComponent_a8a977ebc872c5d5ea7ee689724c0860,
  "@payloadcms/plugin-seo/client#MetaImageComponent": MetaImageComponent_a8a977ebc872c5d5ea7ee689724c0860,
  "@payloadcms/plugin-seo/client#MetaDescriptionComponent": MetaDescriptionComponent_a8a977ebc872c5d5ea7ee689724c0860,
  "@payloadcms/plugin-seo/client#PreviewComponent": PreviewComponent_a8a977ebc872c5d5ea7ee689724c0860,
  "@/components/admin/GenerateArticleButton#GenerateArticleButton": GenerateArticleButton_e6d4dadec655c9986798da4569523591,
  "@payloadcms/richtext-lexical/client#BlocksFeatureClient": BlocksFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#HorizontalRuleFeatureClient": HorizontalRuleFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@/components/admin/ScraperJobControls#ScraperJobControls": ScraperJobControls_54c2152edd141df45ff6246d637d64e0,
  "@/components/admin/ScraperJobCategories#ScraperJobCategories": ScraperJobCategories_94b6c833d548b2586430bc92ae85424d,
  "@/components/admin/ScraperJobPreviews#ScraperJobPreviews": ScraperJobPreviews_1c84b06a05c8a26ced6d29b226b0c933,
  "@payloadcms/plugin-ecommerce/rsc#VariantOptionsSelector": VariantOptionsSelector_b91672ccd6e8b071c11142ab941fedfb,
  "@/components/admin/PurgeCacheButton#PurgeCacheButton": PurgeCacheButton_967dc17052d37888c9ed04fb08af2bb7,
  "@/components/admin/StatsView#StatsView": StatsView_019064b858e8ae6d080010e39be16092,
  "@/components/admin/Icon#Icon": Icon_534076e2c753ea5d539a54b05f456b1b,
  "@/components/admin/Logo#Logo": Logo_a44df17d0fc3dcd873dae43dc3bf66bd,
  "@/components/BeforeDashboard#BeforeDashboard": BeforeDashboard_1a7510af427896d367a49dbf838d2de6,
  "@/components/admin/RecentOrders#RecentOrders": RecentOrders_b612e731223fb07b8283add29afed720,
  "@/components/admin/StatsSummary#StatsSummary": StatsSummary_6c08412ac035a619107044245a9c0c48,
  "@/components/BeforeLogin#BeforeLogin": BeforeLogin_8a7ab0eb7ab5c511aba12e68480bfe5e,
  "@/components/admin/BrandFonts#BrandFonts": BrandFonts_90f8fc7531fcce4c65370cfaaa680a41,
  "@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler": VercelBlobClientUploadHandler_16c82c5e25f430251a3e3ba57219ff4e,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1
}
