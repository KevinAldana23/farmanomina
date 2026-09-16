import { getLegalConfigs } from '../actions/configActions';
import ConfigEditor from './ConfigEditor';

export default async function ConfiguracionPage() {
  const configs = await getLegalConfigs();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Parámetros Legales</h1>
        <p className="text-muted-foreground mt-1">
          Ajusta el salario mínimo, auxilio de transporte y jornada laboral según la normativa de cada año.
        </p>
      </div>
      
      <div className="space-y-8">
        {configs.map(config => (
          <ConfigEditor key={config.id} config={config} />
        ))}
        {configs.length === 0 && (
          <p>No hay configuraciones.</p>
        )}
      </div>
    </div>
  );
}
