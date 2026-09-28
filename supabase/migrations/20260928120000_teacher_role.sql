-- Teachers run the Sementinhas classes. The value lives in its own migration
-- because a new enum value cannot be used in the transaction that adds it.
alter type public.system_role add value if not exists 'teacher';
