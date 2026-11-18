-- updated_at automatique sur la table des entretiens (même règle que les autres tables).
CREATE TRIGGER entretiens_maj_updated_at BEFORE UPDATE ON entretiens
  FOR EACH ROW EXECUTE FUNCTION maj_updated_at();
